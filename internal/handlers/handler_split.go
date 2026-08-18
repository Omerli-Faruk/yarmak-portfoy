package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// @Summary Bedelsiz/Ters Bölünme Uygula (Admin)
// @Description Hissede bölünme uygular ve tüm kullanıcıların geçmiş işlemlerini günceller
// @Tags Splits
// @Security BearerAuth
// @Accept json
// @Produce json
// @Router /splits [post]
func (cfg *ApiConfig) HandlerCreateSplit(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		AssetID    int64     `json:"asset_id"`
		SplitRatio string    `json:"split_ratio"`
		SplitDate  time.Time `json:"split_date"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.AssetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Lütfen geçerli bir hisse senedi ID'si belirtin", nil)
		return
	}
	splitRatio, err := strconv.ParseFloat(params.SplitRatio, 64)
	if err != nil || splitRatio <= 0 {
		respondWithError(w, http.StatusBadRequest, "Bölünme oranı 0'dan büyük geçerli bir sayı olmalıdır", err)
		return
	}
	if params.SplitDate.IsZero() {
		params.SplitDate = time.Now().UTC()
	}
	asset, err := cfg.DB.GetAssetByID(r.Context(), params.AssetID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Bölünme uygulanacak hisse senedi sistemde bulunamadı", err)
		return
	}
	split, err := cfg.DB.CreateSplit(r.Context(), database.CreateSplitParams{
		AssetID:    asset.ID,
		SplitRatio: params.SplitRatio,
		SplitDate:  params.SplitDate,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Bölünme kaydı oluşturulurken hata meydana geldi", err)
		return
	}
	err = cfg.DB.ApplyStockSplitToTransactions(r.Context(), database.ApplyStockSplitToTransactionsParams{
		AssetID:         asset.ID,
		Amount:          params.SplitRatio,
		TransactionDate: params.SplitDate,
	})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Hisseye ait geçmiş işlemler bölünme oranına göre güncellenemedi", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, split)
}

// @Summary Hissenin Bölünme Geçmişi
// @Description Belirli bir hissenin geçmişte yaşadığı tüm bedelsiz bölünmeleri listeler
// @Tags Splits
// @Security BearerAuth
// @Produce json
// @Router /assets/{id}/splits [get]
func (cfg *ApiConfig) HandlerListSplitsByAsset(w http.ResponseWriter, r *http.Request) {
	assetIDStr := chi.URLParam(r, "id")
	assetID, err := strconv.ParseInt(assetIDStr, 10, 64)
	if err != nil || assetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Lütfen geçerli bir hisse senedi ID'si belirtin", err)
		return
	}
	splits, err := cfg.DB.ListSplitsByAsset(r.Context(), assetID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Bölünme geçmişi listelenirken hata oluştu", err)
		return
	}
	if splits == nil {
		splits = []database.Split{}
	}
	respondWithJSON(w, http.StatusOK, splits)
}
