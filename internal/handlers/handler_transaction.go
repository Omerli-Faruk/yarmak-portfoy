package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"time"
)

func (cfg *ApiConfig) HandlerCreateTransaction(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		AssetID         int64     `json:"asset_id"`
		Type            string    `json:"type"`
		Amount          string    `json:"amount"`
		Price           string    `json:"price"`
		TransactionDate time.Time `json:"transaction_date"`
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
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	transaction, err := cfg.DB.CreateTransaction(r.Context(), database.CreateTransactionParams{
		UserID:          userID,
		AssetID:         params.AssetID,
		Type:            params.Type,
		Amount:          params.Amount,
		Price:           params.Price,
		TransactionDate: params.TransactionDate,
	})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "İşlem oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, transaction)
}

func (cfg *ApiConfig) HandlerGetUserHoldings(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Portföyünüzde varlık bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, holdings)
}
