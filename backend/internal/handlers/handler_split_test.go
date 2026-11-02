package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"yarmak/internal/database"
)

// Hisse aranırken veritabanı hata verirse admin "hisse sistemde yok" (404) değil 500 görmeli.
func TestCreateSplitDBErrorIsNot404(t *testing.T) {
	conn, err := sql.Open("postgres", "postgres://kimse:yok@127.0.0.1:1/yok?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	conn.Close()
	cfg := &ApiConfig{DB: database.New(conn), DBConn: conn}

	req := httptest.NewRequest("POST", "/v1/splits", strings.NewReader(`{"asset_id":7,"split_ratio":"2"}`))
	req = req.WithContext(context.WithValue(req.Context(), UserIDKey, int64(1)))
	rr := httptest.NewRecorder()

	cfg.HandlerCreateSplit(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("veritabanı hatasında 500 bekleniyordu, %d geldi: %s", rr.Code, rr.Body.String())
	}
}
