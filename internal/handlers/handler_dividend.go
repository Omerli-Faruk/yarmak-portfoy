package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

func getUserHoldingLot(holdings []database.GetUserHoldingsSummaryRow, assetID int64) float64 {
	for _, h := range holdings {
		if h.AssetID == assetID {
			lot, _ := strconv.ParseFloat(h.TotalAmount, 64)
			return lot
		}
	}
	return 0
}

// HandlerCreateDividend Temettü Oluştur
func (cfg *ApiConfig) HandlerCreateDividend(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		AssetID        int64     `json:"asset_id"`
		Amount         string    `json:"amount"`
		PaymentDate    time.Time `json:"payment_date"`
		AmountPerShare string    `json:"amount_per_share"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Yetkisiz erişim", nil)
		return
	}
	if params.AmountPerShare != "" {
		holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Portföy bilgileri alınamadı", err)
			return
		}
		userHoldingLot := getUserHoldingLot(holdings, params.AssetID)

		if userHoldingLot <= 0 {
			respondWithError(w, http.StatusBadRequest, "Portföyünüzde bu hisseye ait lot bulunamadı", nil)
			return
		}
		perShare, err := strconv.ParseFloat(params.AmountPerShare, 64)
		if err != nil || perShare <= 0 {
			respondWithError(w, http.StatusBadRequest, "Geçersiz hisse başı temettü miktarı", err)
			return
		}
		totalAmount := userHoldingLot * perShare
		params.Amount = fmt.Sprintf("%.6f", totalAmount)
	}
	if params.PaymentDate.IsZero() {
		params.PaymentDate = time.Now().UTC()
	}
	amount, _ := strconv.ParseFloat(params.Amount, 64)
	if amount <= 0 || params.AssetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Miktar veya Asset ID geçersiz", nil)
		return
	}
	userDividend, err := cfg.DB.CreateDividend(r.Context(), database.CreateDividendParams{
		UserID:      userID,
		AssetID:     params.AssetID,
		Amount:      params.Amount,
		PaymentDate: params.PaymentDate,
	})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Temettü oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, userDividend)
}

// HandlerGetUserDividends Temettü görüntüle
func (cfg *ApiConfig) HandlerGetUserDividends(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	dividends, err := cfg.DB.GetUserDividends(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Temettü bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, dividends)
}

// HandlerDeleteDividend Temettü Sil
func (cfg *ApiConfig) HandlerDeleteDividend(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	dividendID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz temettü ID", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	err = cfg.DB.DeleteDividend(r.Context(), database.DeleteDividendParams{
		ID:     dividendID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Temettü silinemedi", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Temettü kaydı başarıyla silindi"})
}
