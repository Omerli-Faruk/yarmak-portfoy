package handlers

import (
	"net/http"
	"yarmak/internal/database"
	"yarmak/internal/services"
)

// ============================================================================
// API HANDLERS
// ============================================================================

// ============================================================================
// API HANDLERS
// ============================================================================

// HandlerGetPortfolioSummary — Kullanıcının portföyünün tüm anlık resmini çıkarır.
// Toplam değer, maliyet, kâr/zarar, dolar karşılığı, dönemsel getiriler (1D/1W/1M/3M/6M/YTD/1Y)
// ve HISSE/FON/ALTIN/DOVIZ bazında kategori dağılımını tek seferde hesaplayıp döner.
// @Summary Portföy Özeti (TL ve Dolar)
// @Description Toplam portföy değeri, toplam maliyet, kâr/zarar, dolar karşılığı ve kategori dağılımını döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {object} portfolioSummaryResponse
// @Failure 401 {object} map[string]string
// @Router /portfolio/summary [get]
func (cfg *ApiConfig) HandlerGetPortfolioSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	summary, err := cfg.Services.Portfolio.CalculatePortfolioSummary(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Portföy hesaplanırken hata oluştu", err)
		return
	}

	respondWithJSON(w, http.StatusOK, summary)
}

// @Summary Portföy Tarihsel Grafik Geçmişi
// @Description Kullanıcının portföyünün zaman içindeki gelişimini grafik için döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {array} database.PortfolioSnapshot
// @Failure 401 {object} map[string]string
// HandlerGetUserPortfolioHistory — Kullanıcının portföy değer geçmişini döner.
// Dashboard'daki çizgi grafiğinin veri kaynağı budur. Son 365 snapshot döner.
// @Failure 500 {object} map[string]string
// @Router /portfolio/history [get]
func (cfg *ApiConfig) HandlerGetUserPortfolioHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Kullanıcı bulunamadı", nil)
		return
	}
	history, err := cfg.DB.GetUserPortfolioHistory(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Portföy geçmişi getirilirken hata oluştu", err)
		return
	}
	if history == nil {
		history = []database.PortfolioSnapshot{}
	}
	respondWithJSON(w, http.StatusOK, history)
}

// HandlerGetPortfolioValueHistory — Kullanıcının gerçek portföy geçmişini döner.
// Her noktada o anki lotlar, o anki fiyatlar ve o ana kadarki gerçekleşen kâr/temettü kullanılır;
// bugünkü varlıkları geçmişe taşımaz. Zaman çizelgesi portföyün ilk işleminden önce başlamaz.
// @Summary Portföy Değer Geçmişi
// @Description Seçilen aralıkta portföy değeri, maliyeti ve toplam kâr/zararının (gerçekleşen kâr ve temettü dahil) zaman serisini döner. Aralık portföyden uzunsa seri ilk işlemden başlar.
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Param range query string false "Aralık (varsayılan 1Y)" Enums(1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y)
// @Success 200 {object} portfolioValueHistoryResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /portfolio/value-history [get]
func (cfg *ApiConfig) HandlerGetPortfolioValueHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	rng, ok := services.NormalizeValueHistoryRange(r.URL.Query().Get("range"))
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Geçersiz aralık; 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y veya 5Y olmalı", nil)
		return
	}

	history, err := cfg.Services.Portfolio.GetValueHistory(r.Context(), userID, rng)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Portföy geçmişi hesaplanamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, history)
}
