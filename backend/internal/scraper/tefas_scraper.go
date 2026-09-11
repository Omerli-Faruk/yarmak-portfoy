package scraper

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	priceAttrRegex  = regexp.MustCompile(`data-last-price="([0-9.,]+)"`)
	priceClassRegex = regexp.MustCompile(`class="[a-zA-Z0-9\s]*YMlE2[a-zA-Z0-9\s]*"[^>]*>₺?\s*([0-9.,]+)`)
	fundTypeCache   sync.Map
)

// SetFundType caches the known fund type for a fund symbol
func SetFundType(symbol, fType string) {
	fundTypeCache.Store(strings.ToUpper(strings.TrimSpace(symbol)), strings.ToUpper(strings.TrimSpace(fType)))
}

// detectFundType automatically discovers whether a fund is YAT, EMK, BYF, GYF or GSYF
func detectFundType(symbol string) string {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if val, ok := fundTypeCache.Load(symbol); ok {
		return val.(string)
	}

	types := []string{"YAT", "EMK", "BYF", "GYF", "GSYF"}
	now := time.Now()
	bitTarih := now.Format("20060102")
	basTarih := now.AddDate(0, 0, -10).Format("20060102")

	for _, fType := range types {
		reqBody := tefasRequestBody{
			FonTipi:  fType,
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
		if resp.StatusCode == 429 {
			resp.Body.Close()
			time.Sleep(15 * time.Second)
			continue
		}
		if resp.StatusCode == http.StatusOK {
			b, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err == nil {
				var res tefasResponse
				if err := json.Unmarshal(b, &res); err == nil && len(res.ResultList) > 0 {
					fundTypeCache.Store(symbol, fType)
					return fType
				}
			}
		} else {
			resp.Body.Close()
		}
		time.Sleep(200 * time.Millisecond)
	}

	return "YAT"
}

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

	// 1. Resmi TEFAS JSON API sorgusu (Akıllı Fon Tipi Tespiti ile)
	detectedType := detectFundType(symbol)
	typesToTry := []string{detectedType}
	if detectedType != "YAT" {
		typesToTry = append(typesToTry, "YAT")
	}
	if detectedType != "EMK" {
		typesToTry = append(typesToTry, "EMK")
	}

	for _, kind := range typesToTry {
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
	return price, err
}

type TEFASFundData struct {
	Symbol string
	Name   string
	Date   time.Time
	Price  float64
}

// GetLastTradingDay returns the most recent business day when TEFAS prices were finalized
func GetLastTradingDay() time.Time {
	t := time.Now()
	// Fund closing prices are uploaded around 19:00 - 20:30 on weekdays.
	// If it's before 19:00, use yesterday's prices.
	if t.Hour() < 19 {
		t = t.AddDate(0, 0, -1)
	}
	// Rewind over weekends to Friday
	for t.Weekday() == time.Saturday || t.Weekday() == time.Sunday {
		t = t.AddDate(0, 0, -1)
	}
	return t
}

// FetchAllTEFASFunds fetches all funds for the latest available trading day
func FetchAllTEFASFunds(tarih time.Time, fonTipi string) ([]TEFASFundData, error) {
	if tarih.IsZero() || (tarih.Day() == time.Now().Day() && time.Now().Hour() < 19) {
		tarih = GetLastTradingDay()
	}

	for attempt := 0; attempt < 4; attempt++ {
		dateStr := tarih.Format("20060102")

		reqBody := tefasRequestBody{
			FonTipi:  fonTipi,
			BasTarih: dateStr,
			BitTarih: dateStr,
			BasSira:  1,
			BitSira:  5000,
			Dil:      "TR",
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}

		req, err := http.NewRequest("POST", "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", bytes.NewBuffer(jsonBytes))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://www.tefas.gov.tr")
		req.Header.Set("Referer", "https://www.tefas.gov.tr/tr/fon-verileri")
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

		resp, err := client.Do(req)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}

		if resp.StatusCode == 429 {
			resp.Body.Close()
			time.Sleep(15 * time.Second) // WAF rate-limit cooldown
			continue
		}

		if resp.StatusCode == http.StatusOK {
			bodyBytes, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err == nil {
				var tefasRes tefasResponse
				if err := json.Unmarshal(bodyBytes, &tefasRes); err == nil && len(tefasRes.ResultList) > 0 {
					var results []TEFASFundData
					for _, item := range tefasRes.ResultList {
						var parsedDate time.Time
						if item.Tarih != "" {
							if ts, err := strconv.ParseInt(item.Tarih, 10, 64); err == nil {
								parsedDate = time.UnixMilli(ts)
							} else if pt, err := time.Parse("2006-01-02", item.Tarih); err == nil {
								parsedDate = pt
							} else {
								parsedDate = tarih
							}
						} else {
							parsedDate = tarih
						}

						results = append(results, TEFASFundData{
							Symbol: item.FonKodu,
							Name:   item.FonUnvan,
							Date:   parsedDate,
							Price:  item.Fiyat,
						})
						fundTypeCache.Store(item.FonKodu, fonTipi)
					}
					return results, nil
				}
			}
		} else {
			resp.Body.Close()
		}

		// Rewind to previous business day in case the chosen date was a holiday
		tarih = tarih.AddDate(0, 0, -1)
		for tarih.Weekday() == time.Saturday || tarih.Weekday() == time.Sunday {
			tarih = tarih.AddDate(0, 0, -1)
		}
		time.Sleep(3 * time.Second)
	}
	return nil, fmt.Errorf("%s için güncel fon kataloğu bulunamadı", fonTipi)
}

// FetchTEFASFundHistory fetches price history by chunking maximum 30 days per request with rate-limit retries
func FetchTEFASFundHistory(symbol string, startDate, endDate time.Time) ([]TEFASFundData, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	fonTipi := detectFundType(symbol)

	var allResults []TEFASFundData
	currentStart := startDate

	for currentStart.Before(endDate) {
		currentEnd := currentStart.AddDate(0, 0, 30)
		if currentEnd.After(endDate) {
			currentEnd = endDate
		}

		retries := 0
		for retries < 3 {
			reqBody := tefasRequestBody{
				FonTipi:  fonTipi,
				FonKodu:  symbol,
				BasTarih: currentStart.Format("20060102"),
				BitTarih: currentEnd.Format("20060102"),
				BasSira:  1,
				BitSira:  100, // For a single fund, 100 days is enough, but API max is 30 days range
				Dil:      "TR",
			}

			jsonBytes, err := json.Marshal(reqBody)
			if err != nil {
				break
			}

			req, err := http.NewRequest("POST", "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", bytes.NewBuffer(jsonBytes))
			if err != nil {
				break
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "https://www.tefas.gov.tr")
			req.Header.Set("Referer", "https://www.tefas.gov.tr/tr/fon-verileri")
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

			resp, err := client.Do(req)
			if err != nil {
				retries++
				time.Sleep(2 * time.Second)
				continue
			}

			if resp.StatusCode == 429 {
				resp.Body.Close()
				retries++
				slog.Warn("⏳ TEFAS Throttling (429) koruması: 15 saniye bekleniyor...", "fon", symbol, "deneme", retries)
				time.Sleep(15 * time.Second) // WAF rate-limit cooldown
				continue
			}

			if resp.StatusCode == http.StatusOK {
				bodyBytes, err := io.ReadAll(resp.Body)
				resp.Body.Close()
				if err == nil {
					var tefasRes tefasResponse
					if err := json.Unmarshal(bodyBytes, &tefasRes); err == nil {
						for _, item := range tefasRes.ResultList {
							tsStr := item.Tarih
							var parsedDate time.Time
							if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
								parsedDate = time.UnixMilli(ts)
							} else if pt, err := time.Parse("2006-01-02", tsStr); err == nil {
								parsedDate = pt
							} else {
								parsedDate = currentStart
							}
							allResults = append(allResults, TEFASFundData{
								Symbol: item.FonKodu,
								Name:   item.FonUnvan,
								Date:   parsedDate,
								Price:  item.Fiyat,
							})
						}
						break
					}
				}
			} else {
				resp.Body.Close()
			}
			break
		}

		currentStart = currentEnd.AddDate(0, 0, 1)
		time.Sleep(3 * time.Second) // Throttling protection (increased to 3s for safe background syncing)
	}

	return allResults, nil
}
