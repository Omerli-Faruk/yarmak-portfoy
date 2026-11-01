package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"yarmak/internal/database"

	"github.com/go-chi/chi/v5"
	_ "github.com/lib/pq"
)

// Veritabanına ulaşılamadığında işlem "bulunamadı" (404) denmemeli; kullanıcı silindi sanmasın diye 500 dönmeli.
func TestTransactionLookupDBErrorIsNot404(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close() // kapalı bağlantı: her sorgu "database is closed" hatası verir
	cfg := &ApiConfig{DB: database.New(conn)}

	cases := []struct {
		name    string
		method  string
		body    string
		handler http.HandlerFunc
	}{
		{"silme", "DELETE", "", cfg.HandlerDeleteTransaction},
		{"güncelleme", "PUT", `{"type":"BUY","amount":10,"price":5}`, cfg.HandlerUpdateTransaction},
	}
	for _, c := range cases {
		req := httptest.NewRequest(c.method, "/v1/transactions/42", strings.NewReader(c.body))
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", "42")
		ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
		ctx = context.WithValue(ctx, UserIDKey, int64(101))
		rr := httptest.NewRecorder()

		c.handler(rr, req.WithContext(ctx))

		if rr.Code != http.StatusInternalServerError {
			t.Errorf("%s: veritabanı hatasında 500 bekleniyordu, %d geldi: %s", c.name, rr.Code, rr.Body.String())
		}
	}
}
