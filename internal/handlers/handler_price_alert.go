package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// @Summary Fiyat Alarmı Kur
// @Description Belirli bir hisse veya fon hedef fiyata ulaştığında tetiklenecek alarm kurar
// @Tags Alerts
// @Security BearerAuth
// @Accept json
// @Produce json
// @Router /alerts [post]
func (cfg *ApiConfig) HandlerCreatePriceAlert(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		AssetID     int64  `json:"asset_id"`
		TargetPrice string `json:"target_price"`
		Direction   string `json:"direction"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	targetPrice, err := strconv.ParseFloat(params.TargetPrice, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Hedef fiyat geçerli bir sayı olmalıdır.", err)
		return
	}
	if targetPrice <= 0 || params.AssetID <= 0 || (params.Direction != "ABOVE" && params.Direction != "BELOW") {
		respondWithError(w, http.StatusBadRequest, "Geçersiz parametreler: Hedef fiyat 0'dan büyük, varlık ID geçerli ve yön 'ABOVE' veya 'BELOW' olmalıdır", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	priceAlert, err := cfg.DB.CreatePriceAlert(r.Context(), database.CreatePriceAlertParams{
		UserID:      userID,
		AssetID:     params.AssetID,
		TargetPrice: params.TargetPrice,
		Direction:   params.Direction,
	})
	if err != nil {
		respondWithError(w, http.StatusConflict, "Fiyat alarmı oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, priceAlert)
}

// @Summary Kullanıcının Alarmlarını Listele
// @Description Kullanıcının aktif ve tetiklenmiş tüm fiyat alarmlarını listeler
// @Tags Alerts
// @Security BearerAuth
// @Produce json
// @Router /alerts [get]
func (cfg *ApiConfig) HandlerGetUserPriceAlerts(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	priceAlert, err := cfg.DB.GetUserPriceAlert(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Fiyat alarmları listelenirken hata oluştu", err)
		return
	}
	respondWithJSON(w, http.StatusOK, priceAlert)
}

// @Summary Fiyat Alarmını Sil
// @Description Kullanıcının kurduğu bir fiyat alarmını iptal eder/siler
// @Tags Alerts
// @Security BearerAuth
// @Produce json
// @Router /alerts/{id} [delete]
func (cfg *ApiConfig) HandlerDeletePriceAlert(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	priceAlertID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz fiyat alarmı ID'si", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	err = cfg.DB.DeletePriceAlert(r.Context(), database.DeletePriceAlertParams{
		ID:     priceAlertID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Fiyat alarmı silinemedi", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Fiyat alarmı başarıyla silindi"})
}
