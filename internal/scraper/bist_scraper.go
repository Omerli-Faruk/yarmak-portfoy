package scraper

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func FetchBISTPrice(symbol string) (float64, error) {
	querySymbol := symbol
	if !strings.Contains(symbol, "=") && !strings.Contains(symbol, ".") {
		querySymbol = symbol + ".IS"
	}
	req, err := http.NewRequest("GET", "https://query1.finance.yahoo.com/v8/finance/chart/"+querySymbol, nil)
	if err != nil {
		return 0, fmt.Errorf("istek oluşturulamadı: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("bilgileri çekerken hata oluştu: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	type yahooResponse struct {
		Chart struct {
			Result []struct {
				Meta struct {
					RegularMarketPrice float64 `json:"regularMarketPrice"`
				} `json:"meta"`
			} `json:"result"`
		} `json:"chart"`
	}

	params := yahooResponse{}
	err = json.NewDecoder(resp.Body).Decode(&params)
	if err != nil {
		return 0, fmt.Errorf("bilgileri çekerken hata oluştu: %w", err)
	}
	if len(params.Chart.Result) == 0 {
		return 0, fmt.Errorf("hisse verisi bulunamadı: %s", symbol)
	}
	price := params.Chart.Result[0].Meta.RegularMarketPrice
	return price, nil
}
