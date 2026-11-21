package scraper

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// sahteYahoo, gerçek Yahoo yerine verilen durum kodu ve gövdeyle cevap veren bir test sunucusu açar.
// Test bitince sunucuyu kapatır ve yahooBaseURL'i eski hâline döndürür.
// Dönen sayaç, sunucuya kaç istek geldiğini sayar. Önceki testten kalan 429 beklemesi de sıfırlanır.
func sahteYahoo(t *testing.T, status int, body string) *atomic.Int32 {
	t.Helper()
	var istek atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		istek.Add(1)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	eski := yahooBaseURL
	yahooBaseURL = srv.URL
	resetYahooBlock()
	t.Cleanup(func() {
		yahooBaseURL = eski
		srv.Close()
		resetYahooBlock()
	})
	return &istek
}

func resetYahooBlock() {
	yahooBlock.mu.Lock()
	yahooBlock.until = time.Time{}
	yahooBlock.mu.Unlock()
}

// #58: Yahoo 429 verince bekleme süresi boyunca ona hiç istek gitmemeli; hata ErrRateLimited olarak tanınmalı.
func TestFetchYahooPriceStopsAfter429(t *testing.T) {
	istek := sahteYahoo(t, http.StatusTooManyRequests, "")

	_, err := fetchYahooPrice("THYAO.IS")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("429 ErrRateLimited olarak tanınmalı, gelen: %v", err)
	}
	ilk := istek.Load() // ilk çağrı 350 ms arayla 2 kez dener

	_, err = fetchYahooPrice("ASELS.IS")
	if !errors.Is(err, ErrRateLimited) {
		t.Errorf("bekleme sırasında ErrRateLimited bekleniyordu, gelen: %v", err)
	}
	_, _, err = FetchBISTHistoryInterval("GARAN", "1d", "5m")
	if !errors.Is(err, ErrRateLimited) {
		t.Errorf("bekleme sırasında geçmiş de ErrRateLimited dönmeli, gelen: %v", err)
	}
	if n := istek.Load(); n != ilk {
		t.Errorf("bekleme sırasında Yahoo'ya istek gitmemeli: ilk çağrıda %d, sonra toplam %d", ilk, n)
	}
}

// #58: Yahoo 429, Bigpara da düşerse FetchBISTPrice'ın hatası 429'u kaybetmemeli; kapı devre kesiciyi buna bakarak açıyor.
func TestFetchBISTPriceKeepsRateLimitInChain(t *testing.T) {
	sahteYahoo(t, http.StatusTooManyRequests, "") // aynı sahte sunucu Bigpara'ya da 429 döner
	eski := bigparaBaseURL
	bigparaBaseURL = yahooBaseURL
	t.Cleanup(func() { bigparaBaseURL = eski })

	_, err := FetchBISTPrice("THYAO")
	if err == nil {
		t.Fatal("iki kaynak da düşünce hata bekleniyordu")
	}
	if !errors.Is(err, ErrRateLimited) {
		t.Errorf("hata zincirinde ErrRateLimited olmalı (kapı devre kesiciyi açsın), gelen: %v", err)
	}
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
