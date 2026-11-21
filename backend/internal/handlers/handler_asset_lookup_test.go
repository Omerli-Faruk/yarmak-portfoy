package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"yarmak/internal/services"
)

// sayanKaynak, dış fiyat kaynağına kaç kez sorulduğunu sayar; hiçbir sembolü bulamaz.
type sayanKaynak struct{ n atomic.Int32 }

func (s *sayanKaynak) History(string, string, string) ([]scraper.StockHistoricalRecord, error) {
	s.n.Add(1)
	return nil, errors.New("yok")
}
func (s *sayanKaynak) Price(string) (float64, error)     { s.n.Add(1); return 0, errors.New("yok") }
func (s *sayanKaynak) FundPrice(string) (float64, error) { s.n.Add(1); return 0, errors.New("yok") }

// #14: GET durum değiştirmemeli. Bulunamayan sembol için GET dış kaynağa gitmeden 404 döner; ekleme yalnız POST'ta.
func TestLookupAssetGetDoesNotCreate(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close() // kapalı bağlantı: veritabanında hiçbir sembol bulunamaz
	q := database.New(conn)
	kaynak := &sayanKaynak{}
	cfg := &ApiConfig{JWTSecret: "test-secret-test-secret-test-secret", DB: q,
		Services: &services.Services{Asset: services.NewAssetService(q, kaynak)}}
	token, err := auth.MakeJWT(101, cfg.JWTSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}

	istek := func(method string) int {
		req := httptest.NewRequest(method, "/v1/assets/lookup?symbol=YENIX", nil)
		req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
		rr := httptest.NewRecorder()
		cfg.HandlerLookupAsset(rr, req)
		return rr.Code
	}

	if code := istek(http.MethodGet); code != http.StatusNotFound {
		t.Errorf("GET: 404 bekleniyordu, gelen %d", code)
	}
	if n := kaynak.n.Load(); n != 0 {
		t.Errorf("GET dış kaynağa gitmemeli (ekleme denemesi), %d istek gitti", n)
	}

	istek(http.MethodPost)
	if kaynak.n.Load() == 0 {
		t.Error("POST bulunamayan sembolü dış kaynakta aramalıydı")
	}
}
