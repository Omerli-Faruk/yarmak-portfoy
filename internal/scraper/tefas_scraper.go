package scraper

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

func FetchTEFASPrice(symbol string) (float64, error) {
	url := fmt.Sprintf("https://www.google.com/finance/quote/%s:TEFAS", symbol)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("istek oluşturulamadı: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	client := &http.Client{}
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
	re := regexp.MustCompile(`data-last-price="([0-9.,]+)"`)
	matches := re.FindStringSubmatch(body)
	if len(matches) >= 2 {
		priceStr := strings.ReplaceAll(matches[1], ",", "")
		return strconv.ParseFloat(priceStr, 64)
	}

	re2 := regexp.MustCompile(`class="[a-zA-Z0-9\s]*YMlE2[a-zA-Z0-9\s]*"[^>]*>₺?\s*([0-9.,]+)`)
	matches2 := re2.FindStringSubmatch(body)
	if len(matches2) >= 2 {
		priceStr := strings.ReplaceAll(matches2[1], ",", "")
		return strconv.ParseFloat(priceStr, 64)
	}

	re3 := regexp.MustCompile(`>([0-9]+\.[0-9]{2,6})<`)
	matches3 := re3.FindStringSubmatch(body)
	if len(matches3) >= 2 {
		priceStr := strings.ReplaceAll(matches3[1], ",", "")
		return strconv.ParseFloat(priceStr, 64)
	}

	return 0, fmt.Errorf("TEFAS fon verisi bulunamadı: %s", symbol)
}
