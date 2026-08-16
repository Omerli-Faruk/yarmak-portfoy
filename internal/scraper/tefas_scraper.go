package scraper

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

var (
	priceAttrRegex    = regexp.MustCompile(`data-last-price="([0-9.,]+)"`)
	priceClassRegex   = regexp.MustCompile(`class="[a-zA-Z0-9\s]*YMlE2[a-zA-Z0-9\s]*"[^>]*>₺?\s*([0-9.,]+)`)
	priceGenericRegex = regexp.MustCompile(`>([0-9]+\.[0-9]{2,6})<`)
)

func FetchTEFASPrice(symbol string) (float64, error) {
	url := fmt.Sprintf("https://www.google.com/finance/quote/%s:TEFAS", symbol)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("istek oluşturulamadı: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("bilgileri çekerken hata oluştu: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("Google Finance TEFAS yanıt vermedi (HTTP %d)", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("yanıt okunamadı: %w", err)
	}

	body := string(bodyBytes)

	// Regexp for Google Finance price element
	if matches := priceAttrRegex.FindStringSubmatch(body); len(matches) >= 2 {
		return parseLocalizedPrice(matches[1])
	}
	if matches2 := priceClassRegex.FindStringSubmatch(body); len(matches2) >= 2 {
		slog.Warn("TEFAS scraper: data-last-price bulunamadı, 2. yedek regex kullanıldı", "symbol", symbol)
		return parseLocalizedPrice(matches2[1])
	}
	if matches3 := priceGenericRegex.FindStringSubmatch(body); len(matches3) >= 2 {
		slog.Warn("TEFAS scraper: 3. yedek generic regex kullanıldı", "symbol", symbol)
		return parseLocalizedPrice(matches3[1])
	}
	return 0, fmt.Errorf("TEFAS fon verisi bulunamadı: %s", symbol)
}

func parseLocalizedPrice(raw string) (float64, error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "₺")
	raw = strings.TrimSpace(raw)
	if strings.Contains(raw, ".") && strings.Contains(raw, ",") {
		lastDot := strings.LastIndex(raw, ".")
		lastComma := strings.LastIndex(raw, ",")
		if lastComma > lastDot {
			raw = strings.ReplaceAll(raw, ".", "")
			raw = strings.ReplaceAll(raw, ",", ".")
		} else {
			raw = strings.ReplaceAll(raw, ",", "")
		}
	} else if strings.Contains(raw, ",") {
		raw = strings.ReplaceAll(raw, ",", ".")
	}
	return strconv.ParseFloat(raw, 64)
}
