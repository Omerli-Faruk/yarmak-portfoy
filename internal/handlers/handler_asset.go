package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// @Summary Yeni Varlık Tanımla (Admin)
// @Description Sisteme yeni bir hisse, fon, altın veya döviz varlığı ekler
// @Tags Assets
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createAssetRequest true "Varlık Bilgileri"
// @Router /assets [post]
func (cfg *ApiConfig) HandlerCreateAsset(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		Symbol    string `json:"symbol"`
		Name      string `json:"name"`
		AssetType string `json:"asset_type"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.Symbol == "" || params.AssetType == "" {
		respondWithError(w, http.StatusBadRequest, "Symbol ve AssetType zorunludur", nil)
		return
	}
	if params.Name == "" {
		params.Name = params.Symbol
	}
	params.Symbol = strings.ToUpper(strings.TrimSpace(params.Symbol))
	params.AssetType = strings.ToUpper(strings.TrimSpace(params.AssetType))
	if params.AssetType != "HISSE" && params.AssetType != "FON" && params.AssetType != "ALTIN" && params.AssetType != "DOVIZ" {
		respondWithError(w, http.StatusBadRequest, "Varlık tipi 'HISSE', 'FON', 'ALTIN' veya 'DOVIZ' olmalıdır", nil)
		return
	}
	asset, err := cfg.DB.CreateAsset(r.Context(), database.CreateAssetParams{
		Symbol:       params.Symbol,
		Name:         params.Name,
		AssetType:    params.AssetType,
		CurrentPrice: "0.000000",
	})
	if err != nil {
		respondWithError(w, http.StatusConflict, "Asset oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, asset)
}

// @Summary Tüm Varlıkları Listele
// @Description Sistemde kayıtlı tüm BIST hisseleri, TEFAS fonları ve altınları anlık fiyatlarıyla döner
// @Tags Assets
// @Produce json
// @Router /assets [get]
func (cfg *ApiConfig) HandlerListAssets(w http.ResponseWriter, r *http.Request) {
	asset, err := cfg.DB.ListAssets(r.Context())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Varlıklar listelenirken hata oluştu", err)
		return
	}
	respondWithJSON(w, http.StatusOK, asset)
}

// @Summary Varlık Fiyat Geçmişi
// @Description Belirli bir varlığın tarihsel fiyat değişim geçmişini listeler
// @Tags Assets
// @Produce json
// @Router /assets/{id}/price-history [get]
func (cfg *ApiConfig) HandlerGetAssetPriceHistory(w http.ResponseWriter, r *http.Request) {
	asset := chi.URLParam(r, "id")
	assetID, err := strconv.ParseInt(asset, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}
	price, err := cfg.DB.GetAssetPriceHistory(r.Context(), assetID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Fiyat geçmişi bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, price)
}

// @Summary Akıllı Varlık Arama & Keşif
// @Description Sembol ve türe göre varlık arar, sistemde yoksa piyasadan anında çeker
// @Tags Assets
// @Produce json
// @Router /assets/lookup [get]
func (cfg *ApiConfig) HandlerLookupAsset(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	assetType := r.URL.Query().Get("type")
	if symbol == "" {
		respondWithError(w, http.StatusBadRequest, "Sembol parametresi zorunludur", nil)
		return
	}
	if assetType == "" {
		assetType = "HISSE"
	}
	asset, err := cfg.GetOrCreateAssetBySymbol(r.Context(), symbol, assetType)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Varlık bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, asset)
}
