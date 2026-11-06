package scraper

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// sahteYahoo, gerçek Yahoo yerine verilen durum kodu ve gövdeyle cevap veren bir test sunucusu açar.
// Test bitince sunucuyu kapatır ve yahooBaseURL'i eski hâline döndürür.
func sahteYahoo(t *testing.T, status int, body string) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	eski := yahooBaseURL
	yahooBaseURL = srv.URL
	t.Cleanup(func() {
		yahooBaseURL = eski
		srv.Close()
	})
}

func TestFetchBISTHistoryRateLimited(t *testing.T) {
	sahteYahoo(t, http.StatusTooManyRequests, "")

	_, hist, err := FetchBISTHistoryInterval("THYAO", "1d", "5m")
	if err == nil {
		t.Fatal("429'da hata bekleniyordu")
	}
	// Devre kesici 429'u errors.Is ile tanıyacak; hata sarmalanırken ErrRateLimited kaybolmamalı.
	if !errors.Is(err, ErrRateLimited) {
		t.Errorf("429 hatası ErrRateLimited olarak tanınmalı, gelen: %v", err)
	}
	if hist != nil {
		t.Errorf("429'da geçmiş dönmemeli, %d nokta döndü", len(hist))
	}
}

// #43: Yahoo 200 dışı dönünce eskiden Bigpara'dan tek noktalık sahte geçmiş geliyordu.
func TestFetchBISTHistoryNotFoundReturnsError(t *testing.T) {
	sahteYahoo(t, http.StatusNotFound, "")

	_, hist, err := FetchBISTHistoryInterval("THYAO", "1d", "5m")
	if err == nil {
		t.Fatal("404'te hata bekleniyordu")
	}
	if errors.Is(err, ErrRateLimited) {
		t.Errorf("404 istek sınırı hatası sayılmamalı: %v", err)
	}
	if hist != nil {
		t.Errorf("404'te sahte geçmiş dönmemeli, %d nokta döndü", len(hist))
	}
}

func TestFetchBISTHistoryOK(t *testing.T) {
	sahteYahoo(t, http.StatusOK, `{"chart":{"result":[{"meta":{"regularMarketPrice":296.5},
		"timestamp":[1762300800,1762387200],
		"indicators":{"quote":[{"close":[290.0,296.5]}]}}]}}`)

	price, hist, err := FetchBISTHistoryInterval("THYAO", "5d", "1d")
	if err != nil {
		t.Fatalf("hata beklenmiyordu: %v", err)
	}
	if price != 296.5 || len(hist) != 2 {
		t.Errorf("fiyat 296.5 ve 2 nokta bekleniyordu, gelen: %v, %d nokta", price, len(hist))
	}
}

// #35: regularMarketPrice alanı yoksa Go 0 bırakır; 0 fiyat diye dönülmemeli.
func TestFetchYahooPriceMissingField(t *testing.T) {
	sahteYahoo(t, http.StatusOK, `{"chart":{"result":[{"meta":{}}]}}`)

	price, err := fetchYahooPrice("USDTRY=X")
	if err == nil {
		t.Fatalf("eksik alanda hata bekleniyordu, fiyat %v döndü", price)
	}
}
