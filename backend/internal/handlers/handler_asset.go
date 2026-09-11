package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"

	"github.com/go-chi/chi/v5"
)

// @Summary Yeni Varlık Tanımla (Admin)
// @Description Sisteme yeni bir hisse, fon, altın veya döviz varlığı ekler
// @Tags Assets
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createAssetRequest true "Varlık Bilgileri"
// @Success 201 {object} database.Asset
// @Failure 400 {object} map[string]string
// @Router /assets [post]
func (cfg *ApiConfig) HandlerCreateAsset(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := createAssetRequest{}
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

	rangeParam := r.URL.Query().Get("range")

	// Eğer HISSE veya DOVIZ ise anlık olarak Yahoo'dan çek (Kullanıcı talebiyle esnetilen kural)
	assetObj, err := cfg.DB.GetAssetByID(r.Context(), assetID)
	if err == nil && (assetObj.AssetType == "HISSE" || assetObj.AssetType == "DOVIZ") {
		yhRange := "1mo"
		switch rangeParam {
		case "1D":
			yhRange = "1d"
		case "1W":
			yhRange = "1wk"
		case "1M":
			yhRange = "1mo"
		case "3M":
			yhRange = "3mo"
		case "6M":
			yhRange = "6mo"
		case "YTD":
			yhRange = "ytd"
		case "1Y":
			yhRange = "1y"
		case "3Y":
			yhRange = "3y"
		case "5Y", "ALL", "CUSTOM":
			yhRange = "5y"
		}

		_, history, fetchErr := scraper.FetchBISTHistory(assetObj.Symbol, yhRange)
		if fetchErr == nil {
			type mappedHistory struct {
				AssetID    int64     `json:"asset_id"`
				Price      string    `json:"price"`
				RecordedAt time.Time `json:"recorded_at"`
			}
			var mapped []mappedHistory
			for _, h := range history {
				mapped = append(mapped, mappedHistory{
					AssetID:    assetID,
					Price:      fmt.Sprintf("%.6f", h.Price),
					RecordedAt: h.Date,
				})
			}
			respondWithJSON(w, http.StatusOK, mapped)
			return
		}
	}

	var price interface{}

	if rangeParam == "1Y" {
		cutoff := time.Now().AddDate(-1, 0, 0)
		price, err = cfg.DB.GetAssetPriceHistoryWeekly(r.Context(), database.GetAssetPriceHistoryWeeklyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	} else if rangeParam == "ALL" {
		cutoff := time.Now().AddDate(-10, 0, 0) // 10 years for ALL
		price, err = cfg.DB.GetAssetPriceHistoryMonthly(r.Context(), database.GetAssetPriceHistoryMonthlyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	} else {
		// Daily for anything else
		price, err = cfg.DB.GetAssetPriceHistory(r.Context(), assetID)
	}

	if err != nil {
		respondWithError(w, http.StatusNotFound, "Fiyat geçmişi bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, price)
}

func (cfg *ApiConfig) HandlerTriggerBackfill(w http.ResponseWriter, r *http.Request) {
	assetParam := chi.URLParam(r, "id")
	assetID, err := strconv.ParseInt(assetParam, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}
	
	assetObj, err := cfg.DB.GetAssetByID(r.Context(), int64(assetID))
	if err == nil {
		scraper.QuickSyncAsset(r.Context(), cfg.DB, assetObj)
	}

	err = cfg.DB.AddToBackfillQueue(r.Context(), int32(assetID))
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Kuyruğa eklenemedi", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "queued"})
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
