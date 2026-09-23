package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
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

// HandlerListAssets — Sistemde kayıtlı olan tüm finansal varlıkları döner.
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

// HandlerGetAssetPriceHistory — Varlığın tarihsel fiyat grafiğini çizmek için geçmiş fiyat verilerini döndürür. Veri yoğunluğuna göre (1Y, ALL) haftalık veya aylık periyotlara sıkıştırır (downsampling).
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

	// Eğer HISSE, DOVIZ veya ALTIN ise anlık olarak Yahoo'dan çek (Kullanıcı talebiyle esnetilen kural)
	assetObj, err := cfg.DB.GetAssetByID(r.Context(), assetID)
	if err == nil && (assetObj.AssetType == "HISSE" || assetObj.AssetType == "DOVIZ" || assetObj.AssetType == "ALTIN" || assetObj.Symbol == "ALTIN") {
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

	var price []database.PriceHistory

	if rangeParam == "1Y" {
		cutoff := time.Now().AddDate(-1, 0, 0)
		price, err = cfg.DB.GetAssetPriceHistoryWeekly(r.Context(), database.GetAssetPriceHistoryWeeklyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	} else if rangeParam == "ALL" || rangeParam == "5Y" {
		cutoff := time.Now().AddDate(-10, 0, 0) // 10 years for ALL / 5Y
		price, err = cfg.DB.GetAssetPriceHistoryMonthly(r.Context(), database.GetAssetPriceHistoryMonthlyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	} else {
		// Daily for anything else
		price, err = cfg.DB.GetAssetPriceHistory(r.Context(), assetID)
	}

	// Otomatik TEFAS Kurtarma: Eğer varlık bir TEFAS fonuysa ve veritabanında geçmiş veri yoksa (0 adet),
	// kullanıcıyı boş grafikle karşılamamak için anında son 1 aylık TEFAS geçmişini çekip kaydeder
	if err == nil && len(price) == 0 && assetObj.AssetType == "FON" {
		_ = scraper.QuickSyncAsset(r.Context(), cfg.DB, assetObj)
		_ = cfg.DB.AddToBackfillQueue(r.Context(), int32(assetID))

		if rangeParam == "1Y" {
			cutoff := time.Now().AddDate(-1, 0, 0)
			price, err = cfg.DB.GetAssetPriceHistoryWeekly(r.Context(), database.GetAssetPriceHistoryWeeklyParams{
				AssetID:    assetID,
				RecordedAt: cutoff,
			})
		} else if rangeParam == "ALL" || rangeParam == "5Y" {
			cutoff := time.Now().AddDate(-10, 0, 0)
			price, err = cfg.DB.GetAssetPriceHistoryMonthly(r.Context(), database.GetAssetPriceHistoryMonthlyParams{
				AssetID:    assetID,
				RecordedAt: cutoff,
			})
		} else {
			price, err = cfg.DB.GetAssetPriceHistory(r.Context(), assetID)
		}
	}

	if err != nil {
		respondWithError(w, http.StatusNotFound, "Fiyat geçmişi bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, price)
}

// HandlerTriggerBackfill — Eksik geçmiş fiyat verilerini tamamlamak (backfill) için varlığı kuyruğa ekler ve arka planda bir hızlı senkronizasyon tetikler.
func (cfg *ApiConfig) HandlerTriggerBackfill(w http.ResponseWriter, r *http.Request) {
	assetParam := chi.URLParam(r, "id")
	assetID, err := strconv.ParseInt(assetParam, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}
	
	assetObj, err := cfg.DB.GetAssetByID(r.Context(), assetID)
	if err == nil {
		go func() {
			_ = scraper.QuickSyncAsset(context.Background(), cfg.DB, assetObj)
		}()
	}

	err = cfg.DB.AddToBackfillQueue(r.Context(), int32(assetID))
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Kuyruğa eklenemedi", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "queued"})
}

// HandlerLookupAsset — Parametre olarak verilen sembol ve türe göre (HISSE/FON vb.) varlığı sistemde arar, yoksa dış kaynaklardan çekip DB'ye kaydeder.
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
	// Otomatik TEFAS Algılama: 3 harfli sembol BIST hisselerinde bulunamazsa TEFAS fonu olarak dene
	if err != nil && assetType == "HISSE" && len(symbol) == 3 {
		asset, err = cfg.GetOrCreateAssetBySymbol(r.Context(), symbol, "FON")
	}
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Varlık bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, asset)
}

// HandlerGetAssetSummary — Bir varlığın 1G, 1H, 1A, YTD vb. farklı periyotlardaki getiri (return) yüzdelerini hesaplar.
func (cfg *ApiConfig) HandlerGetAssetSummary(w http.ResponseWriter, r *http.Request) {
	assetParam := chi.URLParam(r, "id")
	assetID, err := strconv.ParseInt(assetParam, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}

	summary, err := cfg.DB.GetAssetReturnsSummary(r.Context(), assetID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Getiri özeti alınamadı", err)
		return
	}

	currentP, _ := strconv.ParseFloat(summary.CurrentP, 64)
	p1d, _ := strconv.ParseFloat(summary.P1d, 64)
	p1w, _ := strconv.ParseFloat(summary.P1w, 64)
	p1m, _ := strconv.ParseFloat(summary.P1m, 64)
	p3m, _ := strconv.ParseFloat(summary.P3m, 64)
	p6m, _ := strconv.ParseFloat(summary.P6m, 64)
	pYtd, _ := strconv.ParseFloat(summary.PYtd, 64)
	p1y, _ := strconv.ParseFloat(summary.P1y, 64)
	pAll, _ := strconv.ParseFloat(summary.PAll, 64)

	var p3yStr string
	_ = cfg.DBConn.QueryRowContext(r.Context(), `
		WITH current_price AS (
			SELECT ph.price, ph.recorded_at FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at DESC LIMIT 1
		),
		price_3y AS (
			SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '3 years' ORDER BY ph.recorded_at ASC LIMIT 1
		)
		SELECT COALESCE((SELECT p.price FROM price_3y p), '0')::text;
	`, assetID).Scan(&p3yStr)
	p3y, _ := strconv.ParseFloat(p3yStr, 64)

	calcReturn := func(current, period float64) float64 {
		if period == 0 {
			return 0
		}
		return ((current - period) / period) * 100
	}

	returns := map[string]float64{
		"1D":  calcReturn(currentP, p1d),
		"1W":  calcReturn(currentP, p1w),
		"1M":  calcReturn(currentP, p1m),
		"3M":  calcReturn(currentP, p3m),
		"6M":  calcReturn(currentP, p6m),
		"YTD": calcReturn(currentP, pYtd),
		"1Y":  calcReturn(currentP, p1y),
		"3Y":  calcReturn(currentP, p3y),
		"5Y":  calcReturn(currentP, pAll),
		"ALL": calcReturn(currentP, pAll),
	}

	respondWithJSON(w, http.StatusOK, returns)
}

// HandlerGetAssetDailyChanges — Verilen varlık ID'leri (örn: ?ids=1852,219) veya tüm varlıklar için (?ids=all veya boş) dünden bugüne yüzde değişimleri tek bir SQL sorgusuyla (LATERAL JOIN) hesaplayıp döner.
// Arama ve autocomplete sonuçlarının %0.00 yerine gerçek oranları göstermesini sağlar.
func (cfg *ApiConfig) HandlerGetAssetDailyChanges(w http.ResponseWriter, r *http.Request) {
	idsParam := strings.TrimSpace(r.URL.Query().Get("ids"))

	var query string
	var rows *sql.Rows
	var err error

	if idsParam == "" || idsParam == "all" {
		query = `
			SELECT 
				a.id,
				p1.price as latest_p,
				p2.price as prev_p
			FROM assets a
			JOIN LATERAL (
				SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1
			) p1 ON true
			JOIN LATERAL (
				SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC OFFSET 1 LIMIT 1
			) p2 ON true
			WHERE p2.price > 0;
		`
		rows, err = cfg.DBConn.QueryContext(r.Context(), query)
	} else {
		idStrs := strings.Split(idsParam, ",")
		var ids []int64
		for _, s := range idStrs {
			id, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
			if err == nil {
				ids = append(ids, id)
			}
		}
		if len(ids) == 0 {
			respondWithJSON(w, http.StatusOK, map[string]float64{})
			return
		}

		query = `
			SELECT 
				a.id,
				p1.price as latest_p,
				p2.price as prev_p
			FROM assets a
			LEFT JOIN LATERAL (
				SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1
			) p1 ON true
			LEFT JOIN LATERAL (
				SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC OFFSET 1 LIMIT 1
			) p2 ON true
			WHERE a.id = ANY($1);
		`
		rows, err = cfg.DBConn.QueryContext(r.Context(), query, pq.Array(ids))
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Değişimler alınamadı", err)
		return
	}
	defer rows.Close()

	result := make(map[string]float64)
	for rows.Next() {
		var id int64
		var latestP, prevP sql.NullString
		if err := rows.Scan(&id, &latestP, &prevP); err == nil {
			if latestP.Valid && prevP.Valid {
				p1, err1 := strconv.ParseFloat(latestP.String, 64)
				p2, err2 := strconv.ParseFloat(prevP.String, 64)
				if err1 == nil && err2 == nil && p2 > 0 {
					pct := ((p1 - p2) / p2) * 100
					result[strconv.FormatInt(id, 10)] = math.Round(pct*100) / 100
				}
			}
		}
	}

	respondWithJSON(w, http.StatusOK, result)
}
