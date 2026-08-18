package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

var userLocks [256]sync.Mutex

func lockUser(userID int64) func() {
	idx := uint64(userID) % 256
	userLocks[idx].Lock()
	return userLocks[idx].Unlock
}

type createTransactionParams struct {
	AssetID         int64     `json:"asset_id"`
	Type            string    `json:"type"`
	Amount          string    `json:"amount"`
	Price           string    `json:"price"`
	TransactionDate time.Time `json:"transaction_date"`
	Symbol          string    `json:"symbol"`
	AssetType       string    `json:"asset_type"`
}

// @Summary Alım/Satım İşlemi Yap
// @Description Kullanıcı portföyüne yeni bir alım (BUY) veya satım (SELL) işlemi kaydeder
// @Tags Transactions
// @Security BearerAuth
// @Accept json
// @Produce json
// @Router /transactions [post]
func (cfg *ApiConfig) HandlerCreateTransaction(w http.ResponseWriter, r *http.Request) {

	decoder := json.NewDecoder(r.Body)
	params := createTransactionParams{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.TransactionDate.IsZero() {
		params.TransactionDate = time.Now().UTC()
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

	if params.Type == "SELL" {
		err = cfg.validateSellHolding(r.Context(), userID, params.AssetID, amountVal)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Yetersiz bakiye: Elinizdeki miktardan fazlasını satamazsınız", err)
			return
		}
	}
	cleanAmount := fmt.Sprintf("%.6f", amountVal)
	cleanPrice := fmt.Sprintf("%.6f", priceVal)
	transaction, err := cfg.DB.CreateTransaction(r.Context(), database.CreateTransactionParams{
		UserID:          userID,
		AssetID:         params.AssetID,
		Type:            params.Type,
		Amount:          cleanAmount,
		Price:           cleanPrice,
		TransactionDate: params.TransactionDate,
	})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "İşlem oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, transaction)
}

type userHoldingResponse struct {
	AssetID      int64   `json:"asset_id"`
	Symbol       string  `json:"symbol"`
	AssetName    string  `json:"asset_name"`
	AssetType    string  `json:"asset_type"`
	CurrentPrice float64 `json:"current_price"`
	TotalAmount  float64 `json:"total_amount"`
	AverageCost  float64 `json:"average_cost"`
	TotalValue   float64 `json:"total_value"`
	ProfitLoss   float64 `json:"profit_loss"`
}

// @Summary Kullanıcının Varlıklarını (Holdings) Listele
// @Description Kullanıcının sahip olduğu tüm varlıkları, lot sayılarını ve kâr/zararlarını döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
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
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		var avgCostStr string
		switch v := h.AverageCost.(type) {
		case string:
			avgCostStr = v
		case []byte:
			avgCostStr = string(v)
		default:
			avgCostStr = fmt.Sprintf("%v", v)
		}
		averageCost, _ := strconv.ParseFloat(avgCostStr, 64)
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

// @Summary İşlem Geçmişi (Pagination)
// @Description Kullanıcının geçmiş alım/satım işlemlerini sayfalanmış olarak listeler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
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

// @Summary Alım/Satım İşlemini Sil
// @Description Kullanıcının gerçekleştirdiği bir alım veya satım işlemini siler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
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
		amountVal, _ := strconv.ParseFloat(tx.Amount, 64)
		holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Portföy kontrol edilemedi", err)
			return
		}
		currentHolding := getUserHoldingLot(holdings, tx.AssetID)
		if currentHolding < amountVal {
			respondWithError(w, http.StatusBadRequest, "Bu alım işlemini silemezsiniz, portföyünüz eksiye düşer. Lütfen önce bu varlığa ait satış işlemlerinizi silin.", nil)
			return
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
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "İşlem başarıyla silindi"})
}

func (cfg *ApiConfig) resolveAssetID(ctx context.Context, params *createTransactionParams) error {
	if params.AssetID > 0 {
		return nil
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

func (cfg *ApiConfig) validateSellHolding(ctx context.Context, userID int64, assetID int64, sellAmount float64) error {
	holdings, err := cfg.DB.GetUserHoldingsSummary(ctx, userID)
	if err != nil {
		return err
	}
	currentHolding := getUserHoldingLot(holdings, assetID)
	if sellAmount > currentHolding {
		return fmt.Errorf("yetersiz bakiye: elinizdeki miktardan fazlasını satamazsınız")
	}
	return nil
}
