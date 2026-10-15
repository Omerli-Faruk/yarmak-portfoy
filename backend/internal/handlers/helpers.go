package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// mappedHistory, dış kaynaktan (Yahoo Finance) çekilen canlı geçmiş verilerini frontend uyumlu formata dönüştürmek için kullanılan DTO.
type mappedHistory struct {
	AssetID    int64     `json:"asset_id"`
	Price      string    `json:"price"`
	RecordedAt time.Time `json:"recorded_at"`
}

// parseAssetIDParam, URL path parametresinden (örn: /assets/{id}) varlık ID'sini okur ve int64'e dönüştürür.
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

// parseFloatSafe, string tipindeki sayısal veriyi güvenli biçimde float64'e dönüştürür.
// Hata veya boş veri durumunda sessizce programı kırmak yerine 0.0 döner.
func parseFloatSafe(s string) float64 {
	val, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0.0
	}
	return val
}

// calculatePercentageReturn, iki fiyat arasındaki yüzdesel değişimi ((güncel - önceki) / önceki) * 100 olarak hesaplar.
func calculatePercentageReturn(current, previous float64) float64 {
	if previous <= 0 {
		return 0.0
	}
	return ((current - previous) / previous) * 100.0
}

// mapRangeToYahooFinance, frontend'den gelen aralık kodunu (örn: 1W, 1M, 1Y) Yahoo Finance API'sinin beklediği parametreye eşler.
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

// isValidAssetType, desteklenen finansal varlık tiplerini doğrular.
func isValidAssetType(assetType string) bool {
	switch strings.ToUpper(strings.TrimSpace(assetType)) {
	case "HISSE", "FON", "ALTIN", "DOVIZ":
		return true
	default:
		return false
	}
}

// parseCommaSeparatedIDs, virgülle ayrılmış ID parametresini (örn: "55,179,3157") ayrıştırıp pozitif int64 dilimine dönüştürür.
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
