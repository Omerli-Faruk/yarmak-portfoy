package scraper

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var client = &http.Client{Timeout: 10 * time.Second}

func fetchYahooPrice(ticker string) (float64, error) {
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequest("GET", "https://query1.finance.yahoo.com/v8/finance/chart/"+ticker, nil)
		if err != nil {
			return 0, fmt.Errorf("istek oluşturulamadı: %w", err)
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

		resp, err := client.Do(req)
		if err != nil {
			return 0, fmt.Errorf("bilgileri çekerken hata oluştu: %w", err)
		}

		// Rate limit koruması (HTTP 429 Too Many Requests durumunda 350ms bekle ve tekrar dene)
		if resp.StatusCode == http.StatusTooManyRequests {
			_ = resp.Body.Close()
			if attempt == 0 {
				time.Sleep(350 * time.Millisecond)
				continue
			}
			return 0, fmt.Errorf("Yahoo Finance rate limit aşıldı (HTTP 429)")
		}

		if resp.StatusCode != http.StatusOK {
			_ = resp.Body.Close()
			return 0, fmt.Errorf("Yahoo Finance yanıt vermedi (HTTP %d)", resp.StatusCode)
		}

		var data struct {
			Chart struct {
				Result []struct {
					Meta struct {
						RegularMarketPrice float64 `json:"regularMarketPrice"`
					} `json:"meta"`
				} `json:"result"`
			} `json:"chart"`
		}

		decodeErr := json.NewDecoder(resp.Body).Decode(&data)
		_ = resp.Body.Close()
		if decodeErr != nil || len(data.Chart.Result) == 0 {
			return 0, fmt.Errorf("veri bulunamadı: %s", ticker)
		}
		return data.Chart.Result[0].Meta.RegularMarketPrice, nil
	}
	return 0, fmt.Errorf("veri alınamadı: %s", ticker)
}

func getSpotGramGoldPrice() (float64, error) {
	// 1. Doğrudan Türkiye serbest piyasa spot altın kuru (GAU/TRY)
	req, err := http.NewRequest("GET", "https://finans.truncgil.com/v4/today.json", nil)
	if err == nil {
		req.Header.Set("User-Agent", "Mozilla/5.0")
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			bodyBytes, _ := io.ReadAll(resp.Body)
			bodyStr := string(bodyBytes)

			if idx := strings.Index(bodyStr, `"GRA"`); idx != -1 {
				sub := bodyStr[idx:]
				if closeIdx := strings.Index(sub, "}"); closeIdx != -1 {
					chunk := sub[:closeIdx+1]
					var graData struct {
						GRA struct {
							Selling float64 `json:"Selling"`
							Buying  float64 `json:"Buying"`
						} `json:"GRA"`
					}
					if err := json.Unmarshal([]byte("{"+chunk+"}"), &graData); err == nil && graData.GRA.Selling > 0 {
						return graData.GRA.Selling, nil
					}
				}
			}
		}
	}

	// 2. Yedek fallback: Ons Altın * USD/TRY hesabı
	goldUSD, err := fetchYahooPrice("GC=F")
	if err != nil {
		return 0, fmt.Errorf("ons altın fiyatı çekilemedi: %w", err)
	}
	usdTRY, err := fetchYahooPrice("USDTRY=X")
	if err != nil {
		return 0, fmt.Errorf("dolar/TL kuru çekilemedi: %w", err)
	}
	return (goldUSD * usdTRY) / 31.1034768, nil
}

// Altın türlerinin gram bazlı has ağırlık çarpanları
var goldMultipliers = map[string]float64{
	"GRAMALTIN": 1.0, "GRAM": 1.0, "ALTIN": 1.0, "XAUTRY": 1.0,
	"ALTINS1": 0.01, "ALTIN.S1": 0.01, "ALTIN_S1": 0.01, // 0.01 gr
	"CEYREK": 1.6078, "CEYREKALTIN": 1.6078,
	"YARIM": 3.2156, "YARIMALTIN": 3.2156,
	"TAM": 6.4312, "TAMALTIN": 6.4312, "ZIYNET": 6.4312,
	"CUMHURIYET": 6.6146, "ATA": 6.6146, "ATAALTIN": 6.6146, "CUMHURIYETALTIN": 6.6146,
}

// Özel sembollerin Yahoo Finance karşılıkları
var customTickers = map[string]string{
	"GLDTR":  "GLDTR.IS",
	"USDTRY": "USDTRY=X", "USD": "USDTRY=X", "DOLAR": "USDTRY=X",
	"EURTRY": "EURTRY=X", "EUR": "EURTRY=X", "EURO": "EURTRY=X",
	"GBPTRY": "GBPTRY=X", "GBP": "GBPTRY=X", "STERLIN": "GBPTRY=X",
	// BIST Hisse ve BYF Ticker Eşleştirmeleri
	"GMSTRF": "GMSTR.IS",
	"USDTRF": "USDTR.IS",
	"ZGOLDF": "ZGOLD.IS",
	"LYDIA":  "LYDHO.IS",
	"EFORC":  "EFOR.IS",
	"ENRYA":  "ENERY.IS",
	"QNBFB":  "QNBTR.IS",
	"OYAK":   "OYAKC.IS",
}

func fetchBigparaStockPrice(symbol string) (float64, error) {
	slugMap := map[string]string{
		"KOZAL": "kozal-koza-altin-detay",
		"KOZAA": "kozaa-koza-madencilik-detay",
	}
	slug, ok := slugMap[symbol]
	if !ok {
		slug = strings.ToLower(symbol) + "-detay"
	}

	url := fmt.Sprintf("https://bigpara.hurriyet.com.tr/borsa/hisse-fiyatlari/%s/", slug)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("Bigpara yanıt vermedi (HTTP %d)", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	re := regexp.MustCompile(`<span class="sym__price">([0-9.,]+)</span>`)
	matches := re.FindStringSubmatch(string(body))
	if len(matches) < 2 {
		return 0, fmt.Errorf("fiyat bulunamadı: %s", symbol)
	}

	raw := matches[1]
	raw = strings.ReplaceAll(raw, ".", "")
	raw = strings.ReplaceAll(raw, ",", ".")
	price, err := strconv.ParseFloat(raw, 64)
	if err != nil || price <= 0 {
		return 0, fmt.Errorf("geçersiz fiyat: %s", raw)
	}

	return price, nil
}

func FetchBISTPrice(symbol string) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	// 1. Altın hesaplamaları (Tek bir ortak gram çağrısıyla)
	if mult, exists := goldMultipliers[symbol]; exists {
		gram, err := getSpotGramGoldPrice()
		if err != nil {
			return 0, err
		}
		return gram * mult, nil
	}

	// 2. Ons Altın (TL)
	if symbol == "ONS" || symbol == "ONSALTIN" {
		goldUSD, err := fetchYahooPrice("GC=F")
		if err != nil {
			return 0, err
		}
		usdTRY, err := fetchYahooPrice("USDTRY=X")
		if err != nil {
			return 0, err
		}
		return goldUSD * usdTRY, nil
	}

	// 3. Özel Döviz ve Fon Ticker'ları
	if ticker, exists := customTickers[symbol]; exists {
		return fetchYahooPrice(ticker)
	}

	// 4. Standart Borsa İstanbul Hissesi (THYAO -> THYAO.IS)
	yahooTicker := symbol
	if !strings.Contains(yahooTicker, "=") && !strings.Contains(yahooTicker, ".") {
		yahooTicker += ".IS"
	}
	price, err := fetchYahooPrice(yahooTicker)
	if err == nil && price > 0 {
		return price, nil
	}

	// 5. Alternatif Kaynak: Bigpara (Yahoo'da listelenmeyen TVF vb. hisseler için)
	bpPrice, bpErr := fetchBigparaStockPrice(symbol)
	if bpErr == nil && bpPrice > 0 {
		return bpPrice, nil
	}

	return 0, fmt.Errorf("hisse fiyatı alınamadı (%s): %v", symbol, err)
}

type StockHistoricalRecord struct {
	Date  time.Time
	Price float64
}

// FetchGoldHistory — Gram Altın (TL) geçmiş fiyat verisini Ons Altın (GC=F) ve Dolar/TL (USDTRY=X)
// kurlarını zaman damgalarına göre eşleştirip çarparak (Ons * Dolar / 31.1034768) dinamik üretir.
func FetchGoldHistory(rangeStr string) (float64, []StockHistoricalRecord, error) {
	goldPrice, goldHist, err := FetchBISTHistory("GC=F", rangeStr)
	if err != nil {
		return 0, nil, fmt.Errorf("altın vadeli verisi alınamadı: %w", err)
	}

	usdPrice, usdHist, err := FetchBISTHistory("USDTRY=X", rangeStr)
	if err != nil {
		return 0, nil, fmt.Errorf("dolar/TL verisi alınamadı: %w", err)
	}

	// Güncel gram altın: önce serbest piyasa satış fiyatı (truncgil), olmazsa ons × USD/TRY / 31,1035
	currentGram := (goldPrice * usdPrice) / 31.1034768
	spotGram := 0.0
	if spot, sErr := getSpotGramGoldPrice(); sErr == nil && spot > 0 {
		currentGram = spot
		spotGram = spot
	}

	if len(goldHist) == 0 {
		return currentGram, nil, nil
	}

	// USD/TRY verilerini hem saatlik hem günlük anahtarla saklıyoruz (tatil ve saat farkı koruması)
	usdMap := make(map[int64]float64)
	usdDayMap := make(map[int64]float64)
	for _, u := range usdHist {
		usdMap[u.Date.Unix()/3600] = u.Price
		usdDayMap[u.Date.Unix()/86400] = u.Price
	}

	lastKnownUSD := usdPrice
	if len(usdHist) > 0 {
		lastKnownUSD = usdHist[len(usdHist)-1].Price
	}

	var combined []StockHistoricalRecord
	for _, g := range goldHist {
		hourKey := g.Date.Unix() / 3600
		dayKey := g.Date.Unix() / 86400
		uPrice, found := usdMap[hourKey]
		if !found {
			// Günlük anahtarı kontrol et
			if p, ok := usdDayMap[dayKey]; ok {
				uPrice = p
				found = true
			}
		}
		if !found {
			// En yakın önceki veya sonraki saati dene (-48h ... +48h)
			for offset := int64(1); offset <= 48; offset++ {
				if p, ok := usdMap[hourKey-offset]; ok {
					uPrice = p
					found = true
					break
				}
				if p, ok := usdMap[hourKey+offset]; ok {
					uPrice = p
					found = true
					break
				}
			}
			if !found {
				uPrice = lastKnownUSD
			}
		}

		if g.Price > 0 && uPrice > 0 {
			gram := (g.Price * uPrice) / 31.1034768
			combined = append(combined, StockHistoricalRecord{
				Date:  g.Date,
				Price: math.Round(gram*100) / 100,
			})
		}
	}

	// Kronolojik sıralama garantisi (eskiden yeniye)
	sort.SliceStable(combined, func(i, j int) bool {
		return combined[i].Date.Before(combined[j].Date)
	})

	// GC=F vadeli kontrat olduğu için spot altından genelde biraz pahalıdır (bugün ~%0,6).
	// Geçmişi spot fiyatla aynı seviyeye çekiyoruz; yoksa grafiğin son noktası spot fiyata
	// düşerken uçurum oluşuyor. Yüzde değişimler bu ölçeklemeden etkilenmez.
	// Oran makul aralıkta değilse kaynaklardan biri hatalı demektir, dokunmuyoruz.
	if n := len(combined); n > 0 && spotGram > 0 && combined[n-1].Price > 0 {
		ratio := spotGram / combined[n-1].Price
		if ratio > 0.95 && ratio < 1.05 {
			for i := range combined {
				combined[i].Price = math.Round(combined[i].Price*ratio*100) / 100
			}
		}
	}

	return currentGram, combined, nil
}

// FetchBISTHistory, BIST hissesinin güncel fiyatını ve verilen aralıktaki günlük fiyat geçmişini çeker.
func FetchBISTHistory(symbol string, rangeStr string) (currentPrice float64, history []StockHistoricalRecord, err error) {
	ticker := strings.ToUpper(strings.TrimSpace(symbol))
	if ticker == "ALTIN" || ticker == "GRAMALTIN" || ticker == "GRAM" || ticker == "XAUTRY" {
		return FetchGoldHistory(rangeStr)
	}

	if custom, exists := customTickers[ticker]; exists {
		ticker = custom
	} else if !strings.Contains(ticker, "=") && !strings.Contains(ticker, ".") {
		ticker += ".IS"
	}

	interval := "1d"
	if rangeStr == "1d" {
		interval = "5m"
	} else if rangeStr == "5d" || rangeStr == "1wk" {
		interval = "30m"
	} else if rangeStr == "1mo" {
		interval = "1h"
	} else if rangeStr == "3mo" || rangeStr == "6mo" {
		interval = "1h"
	} else if rangeStr == "1y" || rangeStr == "ytd" {
		interval = "1d"
	} else if rangeStr == "3y" {
		interval = "1wk"
	} else if rangeStr == "5y" || rangeStr == "max" {
		interval = "1mo"
	}

	url := fmt.Sprintf("https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=%s&range=%s", ticker, interval, rangeStr)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Yahoo'da bulunamayan hisseler için Bigpara üzerinden anlık fiyatı çek
		if bpPrice, bpErr := fetchBigparaStockPrice(symbol); bpErr == nil && bpPrice > 0 {
			return bpPrice, []StockHistoricalRecord{
				{
					Date:  time.Now(),
					Price: bpPrice,
				},
			}, nil
		}
		return 0, nil, fmt.Errorf("Yahoo API hata kodu: %d", resp.StatusCode)
	}

	var data struct {
		Chart struct {
			Result []struct {
				Meta struct {
					RegularMarketPrice float64 `json:"regularMarketPrice"`
				} `json:"meta"`
				Timestamp  []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Close []float64 `json:"close"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
		} `json:"chart"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, nil, err
	}
	if len(data.Chart.Result) == 0 {
		return 0, nil, fmt.Errorf("veri bulunamadı: %s", ticker)
	}

	res := data.Chart.Result[0]
	currentPrice = res.Meta.RegularMarketPrice

	if len(res.Timestamp) > 0 && len(res.Indicators.Quote) > 0 && len(res.Indicators.Quote[0].Close) > 0 {
		closes := res.Indicators.Quote[0].Close
		for i, ts := range res.Timestamp {
			if i < len(closes) && closes[i] > 0 {
				history = append(history, StockHistoricalRecord{
					Date:  time.Unix(ts, 0),
					Price: closes[i],
				})
			}
		}
	}

	return currentPrice, history, nil
}
