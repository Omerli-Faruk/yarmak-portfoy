package services

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/wac"
)

// CalculateAssetHoldingAndCost — Varlığın tüm işlem listesini alarak WAC metoduna göre ortalama maliyetini ve eldeki mevcut lot sayısını hesaplar.
// Hesap wac paketinde; bu fonksiyon mevcut çağıranlar için duruyor.
func CalculateAssetHoldingAndCost(transactions []database.Transaction) (currentLot float64, avgCost float64) {
	return wac.HoldingAndCost(transactions)
}

// lotEvent, bakiye kontrolünde kullandığımız sade işlem kaydı.
type lotEvent struct {
	ID   int64
	Date time.Time
	Type string
	Lot  float64
}

// Lotlar 6 hane tutulduğu için float toplama hatalarını bu kadarlık farkla tolere ediyoruz.
const lotTolerance = 0.000001

// firstNegativeLotEvent, hareketleri tarihe (aynı tarihte ID'ye) göre sıralar ve bakiyenin
// ilk kez eksiye düştüğü satışın ID'sini döner. Bakiye hiç eksiye düşmüyorsa ikinci değer false olur.
func firstNegativeLotEvent(events []lotEvent) (int64, bool) {
	return scanNegativeLot(events, 0, true)
}

// firstNegativeLotEventFrom, firstNegativeLotEvent ile aynı hesabı yapar ama startID'li hareketten
// önce sıralanan eksi noktaları atlar. O noktalar yeni işlemden önce geldiği için onun yüzünden
// oluşmamıştır; eski kayıtlarda kalmış bir hata yüzünden bugünkü satışı reddetmek istemiyoruz.
func firstNegativeLotEventFrom(events []lotEvent, startID int64) (int64, bool) {
	return scanNegativeLot(events, startID, false)
}

func scanNegativeLot(events []lotEvent, startID int64, started bool) (int64, bool) {
	sorted := make([]lotEvent, len(events))
	copy(sorted, events)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].Date.Equal(sorted[j].Date) {
			return sorted[i].ID < sorted[j].ID
		}
		return sorted[i].Date.Before(sorted[j].Date)
	})
	balance := 0.0
	for _, e := range sorted {
		if e.ID == startID {
			started = true
		}
		switch e.Type {
		case "BUY":
			balance += e.Lot
		case "SELL":
			balance -= e.Lot
			if started && balance < -lotTolerance {
				return e.ID, true
			}
		}
	}
	return 0, false
}

func (s *TransactionService) CreateTransaction(ctx context.Context, userID int64, params CreateTransactionDTO) (database.Transaction, error) {
	amountVal, err := strconv.ParseFloat(params.Amount, 64)
	if err != nil || amountVal <= 0 {
		return database.Transaction{}, fmt.Errorf("İşlem miktarı 0'dan büyük olmalıdır")
	}

	priceVal, err := strconv.ParseFloat(params.Price, 64)
	if err != nil || priceVal <= 0 {
		return database.Transaction{}, fmt.Errorf("İşlem fiyatı 0'dan büyük olmalıdır")
	}

	commissionVal, _ := strconv.ParseFloat(params.Commission, 64)
	if commissionVal < 0 {
		commissionVal = 0
	}
	var realizedPnL float64

	splits, err := s.DB.ListSplitsByAsset(ctx, params.AssetID)
	if err == nil {
		for _, sp := range splits {
			if sp.SplitDate.After(params.TransactionDate) {
				splitRatio, _ := strconv.ParseFloat(sp.SplitRatio, 64)
				amountVal = amountVal * splitRatio
				priceVal = priceVal / splitRatio
			}
		}
	}

	var transaction database.Transaction
	err = s.inTx(ctx, func(q database.Querier) error {
		if params.Type == "SELL" {
			userTxs, err := q.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
				UserID:  userID,
				AssetID: params.AssetID,
			})
			if err != nil {
				return fmt.Errorf("Geçmiş işlemler çekilemedi: %w", err)
			}

			// Yeni satış henüz kaydedilmediği için en büyük ID'yi veriyoruz; aynı tarihli kayıtların
			// arkasına dizilir, veritabanına yazıldığında da sırası değişmez.
			const newSellID = math.MaxInt64
			events := make([]lotEvent, 0, len(userTxs)+1)
			for _, t := range userTxs {
				lot, _ := strconv.ParseFloat(t.Amount, 64)
				events = append(events, lotEvent{ID: t.ID, Date: t.TransactionDate, Type: t.Type, Lot: lot})
			}
			events = append(events, lotEvent{ID: newSellID, Date: params.TransactionDate, Type: "SELL", Lot: amountVal})
			if failedID, negative := firstNegativeLotEventFrom(events, newSellID); negative {
				if failedID == newSellID {
					return fmt.Errorf("Yetersiz bakiye: Elinizdeki miktardan fazlasını satamazsınız")
				}
				return fmt.Errorf("Geçmiş tarihli bu işlem, sonraki günlerde bakiyeyi eksiye düşürüyor")
			}
			realizedPnL = 0
		}

		cleanAmount := fmt.Sprintf("%.6f", amountVal)
		cleanPrice := fmt.Sprintf("%.6f", priceVal)
		cleanRealizedPnL := fmt.Sprintf("%.6f", realizedPnL)
		cleanCommission := fmt.Sprintf("%.6f", commissionVal)

		var err error
		transaction, err = q.CreateTransaction(ctx, database.CreateTransactionParams{
			UserID:          userID,
			AssetID:         params.AssetID,
			Type:            params.Type,
			Amount:          cleanAmount,
			Price:           cleanPrice,
			TransactionDate: params.TransactionDate,
			RealizedPnl:     cleanRealizedPnL,
			Commission:      cleanCommission,
		})
		if err != nil {
			return fmt.Errorf("İşlem oluşturulamadı: %w", err)
		}

		if err := recalculateRealizedPnL(ctx, q, userID, params.AssetID); err != nil {
			return fmt.Errorf("Gerçekleşen kâr/zarar hesaplanamadı: %w", err)
		}
		return nil
	})
	if err != nil {
		return database.Transaction{}, err
	}

	return transaction, nil
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, userID int64, txID int64, params UpdateTransactionDTO) (database.Transaction, error) {
	var updatedTx database.Transaction
	err := s.inTx(ctx, func(q database.Querier) error {
		// 1. Mevcut işlemi doğrula ve varlık ID'sini öğren
		tx, err := q.GetTransactionByIDAndUser(ctx, database.GetTransactionByIDAndUserParams{
			ID:     txID,
			UserID: userID,
		})
		if err != nil {
			return fmt.Errorf("İşlem bulunamadı veya yetkiniz yok")
		}

		// 2. İşlemin yeni hâliyle bakiyenin hiçbir tarihte eksiye düşmediğini kontrol et
		userTxs, err := q.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: tx.AssetID,
		})
		if err != nil {
			return fmt.Errorf("İşlem geçmişi kontrol edilemedi: %w", err)
		}

		events := make([]lotEvent, 0, len(userTxs))
		for _, t := range userTxs {
			if t.ID == txID {
				events = append(events, lotEvent{ID: txID, Date: params.TransactionDate, Type: params.Type, Lot: params.Amount})
				continue
			}
			lot, _ := strconv.ParseFloat(t.Amount, 64)
			events = append(events, lotEvent{ID: t.ID, Date: t.TransactionDate, Type: t.Type, Lot: lot})
		}
		if _, negative := firstNegativeLotEvent(events); negative {
			return fmt.Errorf("Bu güncelleme, ilgili tarihteki veya sonraki satış işlemleri için bakiyeyi eksiye düşürmektedir")
		}

		cleanAmount := fmt.Sprintf("%.6f", params.Amount)
		cleanPrice := fmt.Sprintf("%.6f", params.Price)
		cleanCommission := fmt.Sprintf("%.6f", params.Commission)

		updatedTx, err = q.UpdateTransaction(ctx, database.UpdateTransactionParams{
			Type:            params.Type,
			Amount:          cleanAmount,
			Price:           cleanPrice,
			TransactionDate: params.TransactionDate,
			Commission:      cleanCommission,
			ID:              txID,
			UserID:          userID,
		})
		if err != nil {
			return fmt.Errorf("İşlem güncellenemedi: %w", err)
		}

		if err := recalculateRealizedPnL(ctx, q, userID, tx.AssetID); err != nil {
			return fmt.Errorf("Gerçekleşen kâr/zarar hesaplanamadı: %w", err)
		}
		return nil
	})
	if err != nil {
		return database.Transaction{}, err
	}

	return updatedTx, nil
}

func (s *TransactionService) DeleteTransaction(ctx context.Context, userID int64, txID int64) error {
	return s.inTx(ctx, func(q database.Querier) error {
		tx, err := q.GetTransactionByIDAndUser(ctx, database.GetTransactionByIDAndUserParams{
			ID:     txID,
			UserID: userID,
		})
		if err != nil {
			return fmt.Errorf("İşlem bulunamadı veya yetkiniz yok")
		}
		if tx.Type == "BUY" {
			userTxs, err := q.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
				UserID:  userID,
				AssetID: tx.AssetID,
			})
			if err != nil {
				return fmt.Errorf("İşlem geçmişi kontrol edilemedi: %w", err)
			}
			events := make([]lotEvent, 0, len(userTxs))
			for _, t := range userTxs {
				if t.ID == txID {
					continue
				}
				lot, _ := strconv.ParseFloat(t.Amount, 64)
				events = append(events, lotEvent{ID: t.ID, Date: t.TransactionDate, Type: t.Type, Lot: lot})
			}
			if _, negative := firstNegativeLotEvent(events); negative {
				return fmt.Errorf("Bu alım işlemini silemezsiniz; geçmişteki satış işlemleriniz için bakiye eksiye düşecektir")
			}
		}
		err = q.DeleteTransaction(ctx, database.DeleteTransactionParams{
			ID:     txID,
			UserID: userID,
		})
		if err != nil {
			return fmt.Errorf("İşlem silinemedi: %w", err)
		}

		if err := recalculateRealizedPnL(ctx, q, userID, tx.AssetID); err != nil {
			return fmt.Errorf("Gerçekleşen kâr/zarar hesaplanamadı: %w", err)
		}
		return nil
	})
}

func (s *TransactionService) GetUserHoldings(ctx context.Context, userID int64) ([]UserHoldingResponse, error) {
	holdings, err := s.DB.GetUserHoldingsSummary(ctx, userID)
	if err != nil {
		return []UserHoldingResponse{}, nil
	}
	res := make([]UserHoldingResponse, 0, len(holdings))

	allTxs, _ := s.DB.GetAllUserTransactions(ctx, userID)
	txsByAsset := make(map[int64][]database.Transaction)
	for _, tx := range allTxs {
		txsByAsset[tx.AssetID] = append(txsByAsset[tx.AssetID], tx)
	}
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		userTxs := txsByAsset[h.AssetID]
		_, averageCost := CalculateAssetHoldingAndCost(userTxs)

		var firstBuyDate *time.Time
		for _, tx := range userTxs {
			if tx.Type == "BUY" {
				if firstBuyDate == nil || tx.TransactionDate.Before(*firstBuyDate) {
					t := tx.TransactionDate
					firstBuyDate = &t
				}
			}
		}

		totalValue := currentPrice * totalAmount
		costValue := averageCost * totalAmount
		res = append(res, UserHoldingResponse{
			AssetID:      h.AssetID,
			Symbol:       h.Symbol,
			AssetName:    h.AssetName,
			AssetType:    h.AssetType,
			CurrentPrice: currentPrice,
			TotalAmount:  totalAmount,
			AverageCost:  averageCost,
			TotalValue:   totalValue,
			ProfitLoss:   totalValue - costValue,
			FirstBuyDate: firstBuyDate,
		})
	}
	return res, nil
}
