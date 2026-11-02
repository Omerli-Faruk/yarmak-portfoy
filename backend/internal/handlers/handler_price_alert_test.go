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

	"github.com/go-chi/chi/v5"
)

// fiyatYok, hiçbir sembolün fiyatını bulamayan sahte fiyat kaynağı.
type fiyatYok struct{}

func (fiyatYok) History(string, string, string) ([]scraper.StockHistoricalRecord, error) {
	return nil, errors.New("yok")
}
func (fiyatYok) Price(string) (float64, error)     { return 0, errors.New("yok") }
func (fiyatYok) FundPrice(string) (float64, error) { return 0, errors.New("yok") }

// Alarmlar okunamazsa silme "bulunamadı" (404) dememeli; kullanıcı alarmı silindi sanmasın diye 500 dönmeli.
func TestDeletePriceAlertDBErrorIsNot404(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close()
	cfg := &ApiConfig{DB: database.New(conn)}

	req := httptest.NewRequest("DELETE", "/v1/alerts/42", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "42")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, UserIDKey, int64(101))
	rr := httptest.NewRecorder()

	cfg.HandlerDeletePriceAlert(rr, req.WithContext(ctx))

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("veritabanı hatasında 500 bekleniyordu, %d geldi: %s", rr.Code, rr.Body.String())
	}
}

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
