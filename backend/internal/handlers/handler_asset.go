package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"

	"github.com/go-chi/chi/v5"
)

// mappedHistory — Dış kaynaktan (Yahoo Finance) çekilen canlı geçmiş verilerini frontend uyumlu formata dönüştürmek için kullanılan DTO.
type mappedHistory struct {
	AssetID    int64     `json:"asset_id"`
	Price      string    `json:"price"`
	RecordedAt time.Time `json:"recorded_at"`
}

// ============================================================================
// HELPER FONKSİYONLAR (DRY, Tip Güvenliği ve Hata Yönetimi)
// ============================================================================

// parseAssetIDParam — URL path parametresinden (örn: /assets/{id}) varlık ID'sini okur ve int64'e dönüştürür.
func parseAssetIDParam(r *http.Request) (int64, error) {
	param := chi.URLParam(r, "id")
	if param == "" {
		return 0, fmt.Errorf("varlık ID parametresi eksik")
	}
	id, err := strconv.ParseInt(param, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("geçersiz varlık ID: %w", err)
	}
	return id, nil
}

// parseFloatSafe — String tipindeki sayısal veriyi güvenli biçimde float64'e dönüştürür.
// Hata veya boş veri durumunda sessizce programı kırmak yerine 0.0 döner.
func parseFloatSafe(s string) float64 {
	val, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0.0
	}
	return val
}

// calculatePercentageReturn — İki fiyat arasındaki yüzdesel değişimi ((güncel - önceki) / önceki) * 100 olarak hesaplar.
// Sıfıra bölme (division by zero) ve negatif baz fiyat durumlarında koruma sağlar.
func calculatePercentageReturn(current, previous float64) float64 {
	if previous <= 0 {
		return 0.0
	}
	return ((current - previous) / previous) * 100.0
}

// mapRangeToYahooFinance — Frontend'den gelen aralık kodunu (örn: 1W, 1M, 1Y) Yahoo Finance API'sinin beklediği parametreye eşler.
func mapRangeToYahooFinance(rangeParam string) string {
	switch strings.ToUpper(strings.TrimSpace(rangeParam)) {
	case "1D":
		return "1d"
	case "1W":
		return "1wk"
	case "1M":
		return "1mo"
	case "3M":
		return "3mo"
	case "6M":
		return "6mo"
	case "YTD":
		return "ytd"
	case "1Y":
		return "1y"
	case "3Y":
		return "3y"
	case "5Y", "ALL", "CUSTOM":
		return "5y"
	default:
		return "1mo"
	}
}

// isValidAssetType — Desteklenen finansal varlık tiplerini doğrular.
func isValidAssetType(assetType string) bool {
	switch strings.ToUpper(strings.TrimSpace(assetType)) {
	case "HISSE", "FON", "ALTIN", "DOVIZ":
		return true
	default:
		return false
	}
}

// parseCommaSeparatedIDs — Virgülle ayrılmış ID parametresini (örn: "55,179,3157") ayrıştırıp pozitif int64 dilimine dönüştürür.
func parseCommaSeparatedIDs(param string) []int64 {
	trimmed := strings.TrimSpace(param)
	if trimmed == "" || strings.EqualFold(trimmed, "all") {
		return nil
	}
	tokens := strings.Split(trimmed, ",")
	ids := make([]int64, 0, len(tokens))
	for _, token := range tokens {
		if id, err := strconv.ParseInt(strings.TrimSpace(token), 10, 64); err == nil && id > 0 {
			ids = append(ids, id)
		}
	}
	return ids
}

// fetchPriceHistoryByRange — İstenen zaman aralığına göre (haftalık, aylık veya günlük) veritabanından fiyat geçmişini çeker.
// Handler içinde yinelenen kod bloklarını (DRY) tek merkezde toplar.
func (cfg *ApiConfig) fetchPriceHistoryByRange(ctx context.Context, assetID int64, rangeParam string) ([]database.PriceHistory, error) {
	switch strings.ToUpper(strings.TrimSpace(rangeParam)) {
	case "1Y":
		cutoff := time.Now().AddDate(-1, 0, 0)
		return cfg.DB.GetAssetPriceHistoryWeekly(ctx, database.GetAssetPriceHistoryWeeklyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	case "ALL", "5Y":
		cutoff := time.Now().AddDate(-10, 0, 0)
		return cfg.DB.GetAssetPriceHistoryMonthly(ctx, database.GetAssetPriceHistoryMonthlyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	default:
		return cfg.DB.GetAssetPriceHistory(ctx, assetID)
	}
}

// ============================================================================
// API HANDLERS
// ============================================================================

// HandlerCreateAsset — Sisteme yeni bir varlık tanımlar (Admin).
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
	var params createAssetRequest
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}

	params.Symbol = strings.ToUpper(strings.TrimSpace(params.Symbol))
	params.AssetType = strings.ToUpper(strings.TrimSpace(params.AssetType))

	if params.Symbol == "" || params.AssetType == "" {
		respondWithError(w, http.StatusBadRequest, "Symbol ve AssetType zorunludur", nil)
		return
	}

	if !isValidAssetType(params.AssetType) {
		respondWithError(w, http.StatusBadRequest, "Varlık tipi 'HISSE', 'FON', 'ALTIN' veya 'DOVIZ' olmalıdır", nil)
		return
	}

	if params.Name == "" {
		params.Name = params.Symbol
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

// HandlerListAssets — Sistemde kayıtlı olan tüm finansal varlıkları listeler.
// @Summary Tüm Varlıkları Listele
// @Description Sistemde kayıtlı tüm BIST hisseleri, TEFAS fonları ve altınları anlık fiyatlarıyla döner
// @Tags Assets
// @Produce json
// @Router /assets [get]
func (cfg *ApiConfig) HandlerListAssets(w http.ResponseWriter, r *http.Request) {
	assets, err := cfg.DB.ListAssets(r.Context())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Varlıklar listelenirken hata oluştu", err)
		return
	}
	respondWithJSON(w, http.StatusOK, assets)
}

// HandlerGetAssetPriceHistory — Varlığın tarihsel fiyat grafiğini çizmek için geçmiş fiyat verilerini döndürür.
// @Summary Varlık Fiyat Geçmişi
// @Description Belirli bir varlığın tarihsel fiyat değişim geçmişini listeler
// @Tags Assets
// @Produce json
// @Router /assets/{id}/price-history [get]
func (cfg *ApiConfig) HandlerGetAssetPriceHistory(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}

	rangeParam := r.URL.Query().Get("range")

	// Eğer HISSE, DOVIZ veya ALTIN ise öncelikli olarak anlık Yahoo Finance verisi çekilir
	assetObj, err := cfg.DB.GetAssetByID(r.Context(), assetID)
	if err == nil && (assetObj.AssetType == "HISSE" || assetObj.AssetType == "DOVIZ" || assetObj.AssetType == "ALTIN" || assetObj.Symbol == "ALTIN") {
		yhRange := mapRangeToYahooFinance(rangeParam)
		_, history, fetchErr := scraper.FetchBISTHistory(assetObj.Symbol, yhRange)
		if fetchErr == nil {
			mapped := make([]mappedHistory, 0, len(history))
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
		slog.Debug("Yahoo Finance anlık geçmiş çekilemedi, veritabanına başvuruluyor", "symbol", assetObj.Symbol, "error", fetchErr)
	}

	// Veritabanından tarih aralığına uygun geçmiş veriyi çek
	price, err := cfg.fetchPriceHistoryByRange(r.Context(), assetID, rangeParam)

	// Otomatik TEFAS Kurtarma: TEFAS fonu DB'de 0 adet geçmişe sahipse, anında son 1 aylık geçmişi çek ve kaydet
	if err == nil && len(price) == 0 && assetObj.AssetType == "FON" {
		if syncErr := scraper.QuickSyncAsset(r.Context(), cfg.DB, assetObj); syncErr != nil {
			slog.Warn("TEFAS hızlı senkronizasyon başarısız", "symbol", assetObj.Symbol, "error", syncErr)
		}
		if qErr := cfg.DB.AddToBackfillQueue(r.Context(), int32(assetID)); qErr != nil {
			slog.Warn("TEFAS backfill kuyruğuna eklenemedi", "asset_id", assetID, "error", qErr)
		}

		price, err = cfg.fetchPriceHistoryByRange(r.Context(), assetID, rangeParam)
	}

	if err != nil {
		respondWithError(w, http.StatusNotFound, "Fiyat geçmişi bulunamadı", err)
		return
	}

	respondWithJSON(w, http.StatusOK, price)
}

// HandlerTriggerBackfill — Eksik geçmiş fiyat verilerini tamamlamak için varlığı kuyruğa ekler ve arka planda senkronizasyon başlatır.
func (cfg *ApiConfig) HandlerTriggerBackfill(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}

	assetObj, err := cfg.DB.GetAssetByID(r.Context(), assetID)
	if err == nil {
		go func() {
			if syncErr := scraper.QuickSyncAsset(context.Background(), cfg.DB, assetObj); syncErr != nil {
				slog.Error("Arka plan hızlı varlık senkronizasyonu hatası", "symbol", assetObj.Symbol, "error", syncErr)
			}
		}()
	}

	if err := cfg.DB.AddToBackfillQueue(r.Context(), int32(assetID)); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Kuyruğa eklenemedi", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "queued"})
}

// HandlerLookupAsset — Parametre olarak verilen sembol ve türe göre varlığı arar, yoksa dış kaynaktan bulup DB'ye kaydeder.
// @Summary Akıllı Varlık Arama & Keşif
// @Description Sembol ve türe göre varlık arar, sistemde yoksa piyasadan anında çeker
// @Tags Assets
// @Produce json
// @Router /assets/lookup [get]
func (cfg *ApiConfig) HandlerLookupAsset(w http.ResponseWriter, r *http.Request) {
	symbol := strings.TrimSpace(r.URL.Query().Get("symbol"))
	assetType := strings.TrimSpace(r.URL.Query().Get("type"))

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

// HandlerGetAssetSummary — Bir varlığın 1G, 1H, 1A, YTD, 1Y, 3Y, ALL periyotlarındaki getiri yüzdelerini döner.
func (cfg *ApiConfig) HandlerGetAssetSummary(w http.ResponseWriter, r *http.Request) {
	assetID, err := parseAssetIDParam(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz varlık ID", err)
		return
	}

	summary, err := cfg.DB.GetAssetReturnsSummary(r.Context(), assetID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Getiri özeti alınamadı", err)
		return
	}

	// DRY & Güvenli Parse: Hataları sessizce yutmak yerine varsayılan 0.0 değeriyle koruma
	currentP := parseFloatSafe(summary.CurrentP)
	p1d := parseFloatSafe(summary.P1d)
	p1w := parseFloatSafe(summary.P1w)
	p1m := parseFloatSafe(summary.P1m)
	p3m := parseFloatSafe(summary.P3m)
	p6m := parseFloatSafe(summary.P6m)
	pYtd := parseFloatSafe(summary.PYtd)
	p1y := parseFloatSafe(summary.P1y)
	pAll := parseFloatSafe(summary.PAll)

	// SQLC ile 3 Yıllık Fiyat Sorgusu
	p3yStr, err := cfg.DB.GetAssetPrice3Y(r.Context(), assetID)
	if err != nil {
		slog.Debug("3 yıllık fiyat verisi sorgulanamadı", "asset_id", assetID, "error", err)
	}
	p3y := parseFloatSafe(p3yStr)

	// API sözleşmesini birebir koruyan getiri haritası
	returns := map[string]float64{
		"1D":  calculatePercentageReturn(currentP, p1d),
		"1W":  calculatePercentageReturn(currentP, p1w),
		"1M":  calculatePercentageReturn(currentP, p1m),
		"3M":  calculatePercentageReturn(currentP, p3m),
		"6M":  calculatePercentageReturn(currentP, p6m),
		"YTD": calculatePercentageReturn(currentP, pYtd),
		"1Y":  calculatePercentageReturn(currentP, p1y),
		"3Y":  calculatePercentageReturn(currentP, p3y),
		"5Y":  calculatePercentageReturn(currentP, pAll),
		"ALL": calculatePercentageReturn(currentP, pAll),
	}

	respondWithJSON(w, http.StatusOK, returns)
}

// HandlerGetAssetDailyChanges — Verilen varlık ID'leri veya tüm varlıklar için günlük yüzdesel değişimleri sqlc sorgusuyla hesaplar.
func (cfg *ApiConfig) HandlerGetAssetDailyChanges(w http.ResponseWriter, r *http.Request) {
	idsParam := strings.TrimSpace(r.URL.Query().Get("ids"))
	ids := parseCommaSeparatedIDs(idsParam)

	// Eğer kullanıcı özel filtre talep etti ancak hiçbir geçerli ID çözümlenemezse erken dönüş yap
	if idsParam != "" && !strings.EqualFold(idsParam, "all") && len(ids) == 0 {
		respondWithJSON(w, http.StatusOK, map[string]float64{})
		return
	}

	result := make(map[string]float64)

	// Yardımcı hesaplama fonksiyonu: Satırdaki fiyatları parse edip yüzde hesabı yapar
	calculateChange := func(id int64, latestStr, prevStr string) {
		p1 := parseFloatSafe(latestStr)
		p2 := parseFloatSafe(prevStr)
		if p2 > 0 {
			pct := ((p1 - p2) / p2) * 100.0
			result[strconv.FormatInt(id, 10)] = math.Round(pct*100.0) / 100.0
		}
	}

	if len(ids) == 0 {
		// Tüm varlıkların günlük değişimleri (SQLC)
		rows, err := cfg.DB.GetAssetDailyChangesAll(r.Context())
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Günlük değişimler alınamadı", err)
			return
		}
		for _, row := range rows {
			calculateChange(row.ID, row.LatestP, row.PrevP)
		}
	} else {
		// Belirtilen ID'lerin günlük değişimleri (SQLC)
		rows, err := cfg.DB.GetAssetDailyChangesByIDs(r.Context(), ids)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Günlük değişimler alınamadı", err)
			return
		}
		for _, row := range rows {
			calculateChange(row.ID, row.LatestP, row.PrevP)
		}
	}

	respondWithJSON(w, http.StatusOK, result)
}
