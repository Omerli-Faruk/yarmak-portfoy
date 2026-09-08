package scraper

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	priceAttrRegex  = regexp.MustCompile(`data-last-price="([0-9.,]+)"`)
	priceClassRegex = regexp.MustCompile(`class="[a-zA-Z0-9\s]*YMlE2[a-zA-Z0-9\s]*"[^>]*>₺?\s*([0-9.,]+)`)
)

type tefasRequestBody struct {
	FonTipi     string `json:"fonTipi"`
	FonKodu     string `json:"fonKodu"`
	BasTarih    string `json:"basTarih"`
	BitTarih    string `json:"bitTarih"`
	BasSira     int    `json:"basSira"`
	BitSira     int    `json:"bitSira"`
	Dil         string `json:"dil"`
	SFonTurKod  string `json:"sFonTurKod"`
	FonKod      string `json:"fonKod"`
	FonGrup     string `json:"fonGrup"`
	FonUnvanTip string `json:"fonUnvanTip"`
}

type tefasResponse struct {
	ErrorCode    *string `json:"errorCode"`
	ErrorMessage *string `json:"errorMessage"`
	ResultList   []struct {
		FonKodu  string  `json:"fonKodu"`
		FonUnvan string  `json:"fonUnvan"`
		Tarih    string  `json:"tarih"`
		Fiyat    float64 `json:"fiyat"`
	} `json:"resultList"`
}

func FetchTEFASPrice(symbol string) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	now := time.Now()
	bitTarih := now.Format("20060102")
	basTarih := now.AddDate(0, 0, -7).Format("20060102")

	// 1. Resmi TEFAS JSON API sorgusu (YAT = Yatırım Fonları / Serbest Fonlar, EMK = Emeklilik Fonları)
	for _, kind := range []string{"YAT", "EMK"} {
		reqBody := tefasRequestBody{
			FonTipi:  kind,
			FonKodu:  symbol,
			BasTarih: basTarih,
			BitTarih: bitTarih,
			BasSira:  1,
			BitSira:  5,
			Dil:      "TR",
		}
		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			continue
		}

		req, err := http.NewRequest("POST", "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", bytes.NewBuffer(jsonBytes))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://www.tefas.gov.tr")
		req.Header.Set("Referer", "https://www.tefas.gov.tr/tr/fon-verileri")
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

		resp, err := client.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode == http.StatusOK {
			bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
			_ = resp.Body.Close()
			if err == nil {
				var tefasRes tefasResponse
				if err := json.Unmarshal(bodyBytes, &tefasRes); err == nil && len(tefasRes.ResultList) > 0 {
					price := tefasRes.ResultList[0].Fiyat
					if price > 0 {
						return price, nil
					}
				}
			}
		} else {
			_ = resp.Body.Close()
		}
	}

	// 2. Yedek: Google Finance TEFAS Kazıma
	url := fmt.Sprintf("https://www.google.com/finance/quote/%s:TEFAS", symbol)
	req, err := http.NewRequest("GET", url, nil)
	if err == nil {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		resp, err := client.Do(req)
		if err == nil {
			defer func() { _ = resp.Body.Close() }()
			if resp.StatusCode == http.StatusOK {
				bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
				if err == nil {
					body := string(bodyBytes)
					if matches := priceAttrRegex.FindStringSubmatch(body); len(matches) >= 2 {
						return parseLocalizedPrice(matches[1])
					}
					if matches2 := priceClassRegex.FindStringSubmatch(body); len(matches2) >= 2 {
						return parseLocalizedPrice(matches2[1])
					}
				}
			}
		}
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
	price, err := strconv.ParseFloat(raw, 64)
	if err != nil || price <= 0 {
		return 0, fmt.Errorf("geçersiz fon fiyatı: %s", raw)
	}
	return price, nil
}
