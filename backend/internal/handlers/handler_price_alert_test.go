package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"yarmak/internal/services"
)

// fiyatYok, hiçbir sembolün fiyatını bulamayan sahte fiyat kaynağı.
type fiyatYok struct{}

func (fiyatYok) History(string, string, string) ([]scraper.StockHistoricalRecord, error) {
	return nil, errors.New("yok")
}
func (fiyatYok) Price(string) (float64, error)     { return 0, errors.New("yok") }
func (fiyatYok) FundPrice(string) (float64, error) { return 0, errors.New("yok") }

// Alarm kaydedilemezse 409 değil 500; sembol bulunamazsa sebebi söyleyen 400 dönmeli.
func TestCreatePriceAlertErrors(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close() // kapalı bağlantı: her sorgu hata verir
	q := database.New(conn)
	cfg := &ApiConfig{DB: q, Services: &services.Services{Asset: services.NewAssetService(q, fiyatYok{})}}

	cases := []struct {
		name     string
		body     string
		wantCode int
		wantMsg  string
	}{
		{"kayıt hatası", `{"asset_id":7,"target_price":"100","direction":"ABOVE"}`, http.StatusInternalServerError, "Fiyat alarmı oluşturulamadı"},
		{"bilinmeyen sembol", `{"symbol":"aslesx","target_price":"100","direction":"ABOVE"}`, http.StatusBadRequest, "ASLESX"},
	}
	for _, c := range cases {
		req := httptest.NewRequest("POST", "/v1/alerts", strings.NewReader(c.body))
		req = req.WithContext(context.WithValue(req.Context(), UserIDKey, int64(101)))
		rr := httptest.NewRecorder()

		cfg.HandlerCreatePriceAlert(rr, req)

		if rr.Code != c.wantCode || !strings.Contains(rr.Body.String(), c.wantMsg) {
			t.Errorf("%s: %d %s; beklenen %d ve mesajda %q", c.name, rr.Code, rr.Body.String(), c.wantCode, c.wantMsg)
		}
	}
}
