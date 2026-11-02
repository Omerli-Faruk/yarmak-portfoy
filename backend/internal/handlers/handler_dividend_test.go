package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"yarmak/internal/database"

	"github.com/go-chi/chi/v5"
)

// Stopaj oranı "15" ya da "0.15" gibi gelebilir; 1 ve üstü yüzde sayılır, anlamsız değerler reddedilir.
func TestParseTaxRate(t *testing.T) {
	cases := []struct {
		raw    string
		want   float64
		wantOK bool
	}{
		{"0.15", 0.15, true},
		{"15", 0.15, true},
		{"1", 0.01, true},
		{"0", 0, true},
		{"on", 0, false},
		{"-5", 0, false},
		{"100", 0, false},
	}
	for _, c := range cases {
		got, ok := parseTaxRate(c.raw)
		if ok != c.wantOK || got != c.want {
			t.Errorf("parseTaxRate(%q) = %v, %v; beklenen %v, %v", c.raw, got, ok, c.want, c.wantOK)
		}
	}
}

// Temettüler okunamazsa silme "bulunamadı" (404) dememeli; 500 dönmeli.
func TestDeleteDividendDBErrorIsNot404(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close()
	cfg := &ApiConfig{DB: database.New(conn)}

	req := httptest.NewRequest("DELETE", "/v1/dividends/42", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "42")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, UserIDKey, int64(101))
	rr := httptest.NewRecorder()

	cfg.HandlerDeleteDividend(rr, req.WithContext(ctx))

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("veritabanı hatasında 500 bekleniyordu, %d geldi: %s", rr.Code, rr.Body.String())
	}
}
