package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"

	"github.com/go-chi/chi/v5"
)

type userLock struct {
	sync.Mutex
	count int
}

var (
	globalMu  sync.Mutex
	userLocks = make(map[int64]*userLock)
)

// lockUser — Aynı kullanıcının eşzamanlı işlem yapmasını önleyen per-user mutex. Double-spending koruması sağlar.
func lockUser(userID int64) func() {
	globalMu.Lock()
	mu, exists := userLocks[userID]
	if !exists {
		mu = &userLock{}
		userLocks[userID] = mu
	}
	mu.count++
	globalMu.Unlock()
	mu.Lock()
	return func() {
		globalMu.Lock()
		mu.count--
		if mu.count == 0 {
			delete(userLocks, userID)
		}
		globalMu.Unlock()
		mu.Unlock()
	}
}

// HandlerCreateTransaction — Kullanıcı portföyüne yeni bir alım (BUY) veya satım (SELL) işlemi kaydeder. İleri tarihli işlemleri engeller, split (bölünme) geçmişini hesaba katar.
// @Summary Alım/Satım İşlemi Yap
// @Description Kullanıcı portföyüne yeni bir alım (BUY) veya satım (SELL) işlemi kaydeder
// @Tags Transactions
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createTransactionRequest true "İşlem Bilgileri"
// @Success 201 {object} database.Transaction
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /transactions [post]
func (cfg *ApiConfig) HandlerCreateTransaction(w http.ResponseWriter, r *http.Request) {

	decoder := json.NewDecoder(r.Body)
	params := createTransactionRequest{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.TransactionDate.IsZero() {
		params.TransactionDate = time.Now().UTC()
	}
	if params.TransactionDate.After(time.Now().Add(2 * time.Minute)) {
		respondWithError(w, http.StatusBadRequest, "Gelecek tarihli işlem kaydedilemez", nil)
		return
	}
	if err := cfg.resolveAssetID(r.Context(), &params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.Type != "BUY" && params.Type != "SELL" {
		respondWithError(w, http.StatusBadRequest, "İşlem tipi 'BUY' veya 'SELL' olmalıdır", nil)
		return
	}
	amountVal, err := strconv.ParseFloat(params.Amount, 64)
	if err != nil || amountVal <= 0 {
		respondWithError(w, http.StatusBadRequest, "İşlem miktarı 0'dan büyük olmalıdır", nil)
		return
	}

	priceVal, err := strconv.ParseFloat(params.Price, 64)
	if err != nil || priceVal <= 0 {
		respondWithError(w, http.StatusBadRequest, "İşlem fiyatı 0'dan büyük olmalıdır", nil)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	unlock := lockUser(userID)
	defer unlock()

	commissionVal, _ := strconv.ParseFloat(params.Commission, 64)
	if commissionVal < 0 {
		commissionVal = 0
	}
	var realizedPnL float64

	splits, err := cfg.DB.ListSplitsByAsset(r.Context(), params.AssetID)
	if err == nil {
		for _, s := range splits {
			if s.SplitDate.After(params.TransactionDate) {
				splitRatio, _ := strconv.ParseFloat(s.SplitRatio, 64)
				amountVal = amountVal * splitRatio
				priceVal = priceVal / splitRatio
			}
		}
	}
	if params.Type == "SELL" {
		// 1. Varlığa ait tüm işlemleri eskiden yeniye çekiyoruz
		userTxs, err := cfg.DB.GetUserTransactionsForAsset(r.Context(), database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: params.AssetID,
		})
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Geçmiş işlemler çekilemedi", err)
			return
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
					respondWithError(w, http.StatusInternalServerError, "Geçmiş tarihli bu işlem, sonraki günlerde bakiyeyi eksiye düşürüyor", err)
					return
				}
			}
		}
		if amountVal > runningLot {
			respondWithError(w, http.StatusBadRequest, "Yetersiz bakiye: Elinizdeki miktardan fazlasını satamazsınız", nil)
			return
		}
		realizedPnL = 0
	}

	cleanAmount := fmt.Sprintf("%.6f", amountVal)
	cleanPrice := fmt.Sprintf("%.6f", priceVal)
	cleanRealizedPnL := fmt.Sprintf("%.6f", realizedPnL)
	cleanCommission := fmt.Sprintf("%.6f", commissionVal)

	transaction, err := cfg.DB.CreateTransaction(r.Context(), database.CreateTransactionParams{
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
		respondWithError(w, http.StatusInternalServerError, "İşlem oluşturulamadı", err)
		return
	}
	_ = cfg.recalculateAssetRealizedPnL(r.Context(), userID, params.AssetID)

	// Varlık fiyatı 15 dakikadan eskiyse arka planda piyasa verisini otomatik güncelle
	go func(assetID int64) {
		assetObj, err := cfg.DB.GetAssetByID(context.Background(), assetID)
		if err == nil && time.Since(assetObj.UpdatedAt) > 15*time.Minute {
			_ = scraper.QuickSyncAsset(context.Background(), cfg.DB, assetObj)
		}
	}(params.AssetID)

	respondWithJSON(w, http.StatusCreated, transaction)
}

// HandlerGetUserHoldings — Kullanıcının portföyündeki varlıkları özet olarak listeler. Ortalama maliyet ve anlık fiyat farkına göre anlık Kâr/Zarar durumunu hesaplar.
// @Summary Kullanıcının Varlıklarını (Holdings) Listele
// @Description Kullanıcının sahip olduğu tüm varlıkları, lot sayılarını ve kâr/zararlarını döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {array} userHoldingResponse
// @Failure 401 {object} map[string]string
// @Router /portfolio/holdings [get]
func (cfg *ApiConfig) HandlerGetUserHoldings(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
	if err != nil {
		respondWithJSON(w, http.StatusOK, []userHoldingResponse{})
		return
	}
	res := make([]userHoldingResponse, 0, len(holdings))

	allTxs, _ := cfg.DB.GetAllUserTransactions(r.Context(), userID)
	txsByAsset := make(map[int64][]database.Transaction)
	for _, tx := range allTxs {
		txsByAsset[tx.AssetID] = append(txsByAsset[tx.AssetID], tx)
	}
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		userTxs := txsByAsset[h.AssetID]
		_, averageCost := scraper.CalculateAssetHoldingAndCost(userTxs)

		totalValue := currentPrice * totalAmount
		costValue := averageCost * totalAmount
		res = append(res, userHoldingResponse{
			AssetID:      h.AssetID,
			Symbol:       h.Symbol,
			AssetName:    h.AssetName,
			AssetType:    h.AssetType,
			CurrentPrice: currentPrice,
			TotalAmount:  totalAmount,
			AverageCost:  averageCost,
			TotalValue:   totalValue,
			ProfitLoss:   totalValue - costValue,
		})
	}
	respondWithJSON(w, http.StatusOK, res)
}

// HandlerGetUserTransactions — Kullanıcının işlem geçmişini sayfalayarak (pagination) getirir.
// @Summary İşlem Geçmişi (Pagination)
// @Description Kullanıcının geçmiş alım/satım işlemlerini sayfalanmış olarak listeler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
// @Param page query int false "Sayfa Numarası" default(1)
// @Param limit query int false "Sayfa Başına Kayıt Sayısı" default(10)
// @Success 200 {array} database.Transaction
// @Failure 401 {object} map[string]string
// @Router /transactions [get]
func (cfg *ApiConfig) HandlerGetUserTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	transactions, err := cfg.DB.GetUserTransactionsPaginated(r.Context(), database.GetUserTransactionsPaginatedParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "İşlemler bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, transactions)
}

// HandlerDeleteTransaction — Kullanıcının yaptığı işlemi iptal edip siler. Geçmişteki satışı patlatacak bir alım silme işlemi varsa engeller.
// @Summary Alım/Satım İşlemini Sil
// @Description Kullanıcının gerçekleştirdiği bir alım veya satım işlemini siler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
// @Param id path int true "İşlem ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [delete]
func (cfg *ApiConfig) HandlerDeleteTransaction(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	transactionID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz işlem ID", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	unlock := lockUser(userID)
	defer unlock()
	tx, err := cfg.DB.GetTransactionByIDAndUser(r.Context(), database.GetTransactionByIDAndUserParams{
		ID:     transactionID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "İşlem bulunamadı veya yetkiniz yok", err)
		return
	}
	if tx.Type == "BUY" {
		userTxs, err := cfg.DB.GetUserTransactionsForAsset(r.Context(), database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: tx.AssetID,
		})
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "İşlem geçmişi kontrol edilemedi", err)
			return
		}
		var simulatedLot float64
		for _, t := range userTxs {
			if t.ID == transactionID {
				continue
			}
			tAmount, _ := strconv.ParseFloat(t.Amount, 64)
			if t.Type == "BUY" {
				simulatedLot += tAmount
			} else if t.Type == "SELL" {
				simulatedLot -= tAmount
				if simulatedLot < -0.000001 {
					respondWithError(w, http.StatusBadRequest, "Bu alım işlemini silemezsiniz; geçmişteki satış işlemleriniz için bakiye eksiye düşecektir.", nil)
					return
				}
			}
		}
	}
	err = cfg.DB.DeleteTransaction(r.Context(), database.DeleteTransactionParams{
		ID:     transactionID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "İşlem silinemedi", err)
		return
	}
	_ = cfg.recalculateAssetRealizedPnL(r.Context(), userID, tx.AssetID)
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "İşlem başarıyla silindi"})
}

// resolveAssetID — İşlem yapılmak istenen varlığın (asset) ID'si yoksa sembolü üzerinden veritabanından bulur veya yenisini oluşturur.
func (cfg *ApiConfig) resolveAssetID(ctx context.Context, params *createTransactionRequest) error {
	if params.AssetID > 0 {
		if cfg.DB != nil {
			_, err := cfg.DB.GetAssetByID(ctx, params.AssetID)
			if err == nil {
				return nil
			}
		} else {
			return nil
		}
	}
	if params.Symbol == "" {
		return fmt.Errorf("varlık ID veya Sembol zorunludur")
	}
	if params.AssetType == "" {
		params.AssetType = "HISSE"
	}
	asset, err := cfg.GetOrCreateAssetBySymbol(ctx, params.Symbol, params.AssetType)
	if err != nil {
		return err
	}
	params.AssetID = asset.ID
	return nil
}

// recalculateAssetRealizedPnL — Bir varlığın tüm alım-satım işlemlerini WAC (Ağırlıklı Ortalama Maliyet) yöntemiyle yeniden hesaplar ve her SELL işleminin realized PnL değerini günceller.
func (cfg *ApiConfig) recalculateAssetRealizedPnL(ctx context.Context, userID, assetID int64) error {
	if cfg.DB == nil {
		return nil
	}
	userTxs, err := cfg.DB.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
		UserID:  userID,
		AssetID: assetID,
	})
	if err != nil {
		return err
	}

	runningLot := 0.0
	runningCost := 0.0

	for _, tx := range userTxs {
		amount, _ := strconv.ParseFloat(tx.Amount, 64)
		price, _ := strconv.ParseFloat(tx.Price, 64)
		commission, _ := strconv.ParseFloat(tx.Commission, 64)

		if tx.Type == "BUY" {
			total := (amount * price) + commission
			// Sıfıra bölme koruması: amount parse edilemezse veya 0 ise WAC hesaplaması patlamasın
			if (runningLot + amount) > 0 {
				runningCost = (runningLot*runningCost + total) / (runningLot + amount)
			}
			runningLot += amount
		} else if tx.Type == "SELL" {
			pnl := amount*(price-runningCost) - commission
			cleanPnL := fmt.Sprintf("%.6f", pnl)
			if tx.RealizedPnl != cleanPnL {
				_ = cfg.DB.UpdateTransactionRealizedPnL(ctx, database.UpdateTransactionRealizedPnLParams{
					RealizedPnl: cleanPnL,
					ID:          tx.ID,
					UserID:      userID,
				})
			}
			runningLot -= amount
			if runningLot <= 0.000001 {
				runningLot = 0
				runningCost = 0
			}
		}
	}
	return nil
}
