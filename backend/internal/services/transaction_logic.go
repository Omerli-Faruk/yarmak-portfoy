package services

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"time"
	"yarmak/internal/database"
)

// CalculateAssetHoldingAndCost — Varlığın tüm işlem listesini alarak WAC metoduna göre ortalama maliyetini ve eldeki mevcut lot sayısını hesaplar.
func CalculateAssetHoldingAndCost(transactions []database.Transaction) (currentLot float64, avgCost float64) {
	runningLot := 0.0
	runningCost := 0.0
	for _, tx := range transactions {
		amount, _ := strconv.ParseFloat(tx.Amount, 64)
		price, _ := strconv.ParseFloat(tx.Price, 64)
		commission, _ := strconv.ParseFloat(tx.Commission, 64)
		if tx.Type == "BUY" {
			total := (amount * price) + commission
			// Sıfıra bölme koruması: bozuk veri gelirse NaN yayılmasını engelle
			if (runningLot + amount) > 0 {
				runningCost = (runningLot*runningCost + total) / (runningLot + amount)
			}
			runningLot = runningLot + amount
		} else if tx.Type == "SELL" {
			runningLot = runningLot - amount
			if runningLot <= 0.000001 {
				runningLot = 0
				runningCost = 0
			}
		}
	}
	return runningLot, runningCost
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
	if params.Type == "SELL" {
		userTxs, err := s.DB.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: params.AssetID,
		})
		if err != nil {
			return database.Transaction{}, fmt.Errorf("Geçmiş işlemler çekilemedi: %w", err)
		}

		runningLot := 0.0
		isDatePassed := false
		for _, tx := range userTxs {
			txAmount, _ := strconv.ParseFloat(tx.Amount, 64)
			if tx.TransactionDate.After(params.TransactionDate) {
				isDatePassed = true
			}
			if tx.Type == "BUY" {
				runningLot += txAmount
			} else if tx.Type == "SELL" {
				runningLot -= txAmount
			}
			if isDatePassed {
				if runningLot-amountVal < 0 {
					return database.Transaction{}, fmt.Errorf("Geçmiş tarihli bu işlem, sonraki günlerde bakiyeyi eksiye düşürüyor")
				}
			}
		}
		if amountVal > runningLot {
			return database.Transaction{}, fmt.Errorf("Yetersiz bakiye: Elinizdeki miktardan fazlasını satamazsınız")
		}
		realizedPnL = 0
	}

	cleanAmount := fmt.Sprintf("%.6f", amountVal)
	cleanPrice := fmt.Sprintf("%.6f", priceVal)
	cleanRealizedPnL := fmt.Sprintf("%.6f", realizedPnL)
	cleanCommission := fmt.Sprintf("%.6f", commissionVal)

	transaction, err := s.DB.CreateTransaction(ctx, database.CreateTransactionParams{
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
		return database.Transaction{}, fmt.Errorf("İşlem oluşturulamadı: %w", err)
	}

	return transaction, nil
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, userID int64, txID int64, params UpdateTransactionDTO) (database.Transaction, error) {
	// 1. Mevcut işlemi doğrula ve varlık ID'sini öğren
	tx, err := s.DB.GetTransactionByIDAndUser(ctx, database.GetTransactionByIDAndUserParams{
		ID:     txID,
		UserID: userID,
	})
	if err != nil {
		return database.Transaction{}, fmt.Errorf("İşlem bulunamadı veya yetkiniz yok")
	}

	// 2. Bakiye Simülasyonu
	userTxs, err := s.DB.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
		UserID:  userID,
		AssetID: tx.AssetID,
	})
	if err != nil {
		return database.Transaction{}, fmt.Errorf("İşlem geçmişi kontrol edilemedi: %w", err)
	}

	type simTx struct {
		ID   int64
		Date time.Time
		Type string
		Lot  float64
	}
	var simList []simTx
	for _, t := range userTxs {
		tAmt, _ := strconv.ParseFloat(t.Amount, 64)
		if t.ID == txID {
			simList = append(simList, simTx{
				ID:   txID,
				Date: params.TransactionDate,
				Type: params.Type,
				Lot:  params.Amount,
			})
		} else {
			simList = append(simList, simTx{
				ID:   t.ID,
				Date: t.TransactionDate,
				Type: t.Type,
				Lot:  tAmt,
			})
		}
	}

	sort.SliceStable(simList, func(i, j int) bool {
		if simList[i].Date.Equal(simList[j].Date) {
			return simList[i].ID < simList[j].ID
		}
		return simList[i].Date.Before(simList[j].Date)
	})

	var currentLot float64
	for _, item := range simList {
		if item.Type == "BUY" {
			currentLot += item.Lot
		} else if item.Type == "SELL" {
			currentLot -= item.Lot
			if currentLot < -0.000001 {
				return database.Transaction{}, fmt.Errorf("Bu güncelleme, ilgili tarihteki veya sonraki satış işlemleri için bakiyeyi eksiye düşürmektedir")
			}
		}
	}

	cleanAmount := fmt.Sprintf("%.6f", params.Amount)
	cleanPrice := fmt.Sprintf("%.6f", params.Price)
	cleanCommission := fmt.Sprintf("%.6f", params.Commission)

	updatedTx, err := s.DB.UpdateTransaction(ctx, database.UpdateTransactionParams{
		Type:            params.Type,
		Amount:          cleanAmount,
		Price:           cleanPrice,
		TransactionDate: params.TransactionDate,
		Commission:      cleanCommission,
		ID:              txID,
		UserID:          userID,
	})
	if err != nil {
		return database.Transaction{}, fmt.Errorf("İşlem güncellenemedi: %w", err)
	}

	return updatedTx, nil
}

func (s *TransactionService) DeleteTransaction(ctx context.Context, userID int64, txID int64) error {
	tx, err := s.DB.GetTransactionByIDAndUser(ctx, database.GetTransactionByIDAndUserParams{
		ID:     txID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("İşlem bulunamadı veya yetkiniz yok")
	}
	if tx.Type == "BUY" {
		userTxs, err := s.DB.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: tx.AssetID,
		})
		if err != nil {
			return fmt.Errorf("İşlem geçmişi kontrol edilemedi: %w", err)
		}
		var simulatedLot float64
		for _, t := range userTxs {
			if t.ID == txID {
				continue
			}
			tAmount, _ := strconv.ParseFloat(t.Amount, 64)
			if t.Type == "BUY" {
				simulatedLot += tAmount
			} else if t.Type == "SELL" {
				simulatedLot -= tAmount
				if simulatedLot < -0.000001 {
					return fmt.Errorf("Bu alım işlemini silemezsiniz; geçmişteki satış işlemleriniz için bakiye eksiye düşecektir")
				}
			}
		}
	}
	err = s.DB.DeleteTransaction(ctx, database.DeleteTransactionParams{
		ID:     txID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("İşlem silinemedi: %w", err)
	}
	return nil
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
