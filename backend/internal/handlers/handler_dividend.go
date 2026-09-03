package handlers

import (
	"yarmak/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// @Summary Temettü Geliri Kaydet
// @Description Kullanıcının aldığı nakit temettü ödemesini kaydeder
// @Tags Dividends
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createDividendRequest true "Temettü Bilgileri"
// @Success 201 {object} database.Dividend
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /dividends [post]
func (cfg *ApiConfig) HandlerCreateDividend(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := createDividendRequest{}
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

	grossAmount := amount
	taxAmount := grossAmount * 0.10
	netAmount := grossAmount - taxAmount
	cleanGross := fmt.Sprintf("%.6f", grossAmount)
	cleanTax := fmt.Sprintf("%.6f", taxAmount)
	cleanNet := fmt.Sprintf("%.6f", netAmount)

	userDividend, err := cfg.DB.CreateDividend(r.Context(), database.CreateDividendParams{
		UserID:      userID,
		AssetID:     params.AssetID,
		Amount:      cleanGross,
		PaymentDate: params.PaymentDate,
		GrossAmount: cleanGross,
		TaxAmount:   cleanTax,
		NetAmount:   cleanNet,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Temettü oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, userDividend)
}

// @Summary Kullanıcının Temettü Geçmişi
// @Description Kullanıcının aldığı tüm temettü ödemelerini listeler
// @Tags Dividends
// @Security BearerAuth
// @Produce json
// @Success 200 {array} database.Dividend
// @Failure 401 {object} map[string]string
// @Router /dividends [get]
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

// @Summary Temettü Kaydını Sil
// @Description Kullanıcının kaydettiği bir temettü gelirini siler
// @Tags Dividends
// @Security BearerAuth
// @Produce json
// @Param id path int true "Temettü ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /dividends/{id} [delete]
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
