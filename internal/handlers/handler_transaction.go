package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
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
	if params.Type != "BUY" && params.Type != "SELL" {
		respondWithError(w, http.StatusBadRequest, "İşlem tipi 'BUY' veya 'SELL' olmalıdır", nil)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	if params.Type == "SELL" {
		holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Satış yapmak için portföyünüzde varlık bulunmalıdır", err)
			return
		}
		sellAmount, err := strconv.ParseFloat(params.Amount, 64)
		if err != nil || sellAmount <= 0 {
			respondWithError(w, http.StatusBadRequest, "Geçersiz satış miktarı", err)
			return
		}
		var currentHolding float64
		for _, h := range holdings {
			if h.AssetID == params.AssetID {
				currentHolding, _ = strconv.ParseFloat(h.TotalAmount, 64)
				break
			}
		}
		if sellAmount > currentHolding {
			respondWithError(w, http.StatusBadRequest, "Yetersiz bakiye: Elinizdeki miktardan fazlasını satamazsınız", nil)
			return
		}
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

func (cfg *ApiConfig) HandlerGetUserTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	transactions, err := cfg.DB.GetUserTransactions(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "İşlemler bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, transactions)
}

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
