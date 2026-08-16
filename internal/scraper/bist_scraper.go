package scraper

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var client = &http.Client{Timeout: 10 * time.Second}

func fetchYahooPrice(ticker string) (float64, error) {
	req, err := http.NewRequest("GET", "https://query1.finance.yahoo.com/v8/finance/chart/"+ticker, nil)
	if err != nil {
		return 0, fmt.Errorf("istek oluşturulamadı: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("bilgileri çekerken hata oluştu: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
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

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil || len(data.Chart.Result) == 0 {
		return 0, fmt.Errorf("veri bulunamadı: %s", ticker)
	}
	return data.Chart.Result[0].Meta.RegularMarketPrice, nil
}

func getSpotGramGoldPrice() (float64, error) {
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

// 🪙 Altın türlerinin gram bazlı has ağırlık çarpanları
var goldMultipliers = map[string]float64{
	"GRAMALTIN": 1.0, "GRAM": 1.0, "ALTIN": 1.0, "XAUTRY": 1.0,
	"ALTINS1": 0.01, "ALTIN.S1": 0.01, "ALTIN_S1": 0.01, // 0.01 gr
	"CEYREK": 1.6078, "CEYREKALTIN": 1.6078, // 1.754 gr * (22/24)
	"YARIM": 3.2156, "YARIMALTIN": 3.2156, // 3.508 gr * (22/24)
	"TAM": 6.4312, "TAMALTIN": 6.4312, "ZIYNET": 6.4312, // 7.016 gr * (22/24)
	"CUMHURIYET": 6.6146, "ATA": 6.6146, "ATAALTIN": 6.6146, "CUMHURIYETALTIN": 6.6146, // 7.216 gr * (22/24)
}

// 💱 Özel sembollerin Yahoo Finance karşılıkları
var customTickers = map[string]string{
	"GLDTR":  "GLDTR.IS",
	"USDTRY": "USDTRY=X", "USD": "USDTRY=X", "DOLAR": "USDTRY=X",
	"EURTRY": "EURTRY=X", "EUR": "EURTRY=X", "EURO": "EURTRY=X",
	"GBPTRY": "GBPTRY=X", "GBP": "GBPTRY=X", "STERLIN": "GBPTRY=X",
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
	if !strings.Contains(symbol, "=") && !strings.Contains(symbol, ".") {
		symbol += ".IS"
	}
	return fetchYahooPrice(symbol)
}
