package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"yarmak/internal/database"

	"github.com/go-chi/chi/v5"
)

// @Summary Fiyat Alarmı Kur
// @Description Belirli bir hisse veya fon hedef fiyata ulaştığında tetiklenecek alarm kurar
// @Tags Alerts
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createPriceAlertRequest true "Alarm Bilgileri"
// @Success 201 {object} database.PriceAlert
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /alerts [post]
func (cfg *ApiConfig) HandlerCreatePriceAlert(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := createPriceAlertRequest{}
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
// @Success 200 {array} database.PriceAlert
// @Failure 401 {object} map[string]string
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
// @Param id path int true "Alarm ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
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
	alerts, _ := cfg.DB.GetUserPriceAlert(r.Context(), userID)
	found := false
	for _, a := range alerts {
		if a.ID == priceAlertID {
			found = true
			break
		}
	}
	if !found {
		respondWithError(w, http.StatusNotFound, "Silinecek fiyat alarmı bulunamadı", nil)
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
