package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"yarmak/internal/auth"

	"github.com/go-chi/chi/v5"
)

func TestHealthCheck(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	rr := httptest.NewRecorder()

	HandlerReadiness(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Beklenen HTTP 200, gelen: %v", rr.Code)
	}
}

func TestUnauthorizedAccess(t *testing.T) {
	cfg := &ApiConfig{JWTSecret: "test-secret"}

	protectedHandler := cfg.MiddleWareAuth(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/v1/portfolio/summary", nil)
	rr := httptest.NewRecorder()

	protectedHandler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Yetkisiz istek 401 dönmeliydi! Gelen: %v", rr.Code)
	}
}

func TestInvalidTransactionValidation(t *testing.T) {
	cfg := &ApiConfig{JWTSecret: "test-secret"}

	invalidJSON := `{"asset_id":1,"type":"INVALID","amount":"10","price":"-100"}`
	req := httptest.NewRequest("POST", "/v1/transactions", strings.NewReader(invalidJSON))
	req.Header.Set("Content-Type", "application/json")

	ctx := context.WithValue(req.Context(), UserIDKey, int64(101))
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	cfg.HandlerCreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Geçersiz istek 400 Bad Request dönmeliydi! Gelen: %v", rr.Code)
	}
}

func TestUpdateTransactionRejectsFutureDate(t *testing.T) {
	// Doğrulama veritabanına gitmeden önce bittiği için DB olmadan çalışır.
	cfg := &ApiConfig{JWTSecret: "test-secret"}

	future := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	body := `{"type":"BUY","amount":10,"price":25.5,"transaction_date":"` + future + `"}`
	req := httptest.NewRequest("PUT", "/v1/transactions/1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// chi.URLParam boş dönerse handler yanlış sebeple (geçersiz ID) 400 döner; rota bağlamını elle kuruyoruz.
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "1")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, UserIDKey, int64(101))
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	cfg.HandlerUpdateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("Gelecek tarihli güncelleme 400 dönmeliydi, gelen: %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Gelecek tarihli") {
		t.Errorf("Beklenen hata mesajı gelmedi: %s", rr.Body.String())
	}
}

func TestAuthorizedAccessWithJWT(t *testing.T) {
	secret := "my-secret-key"
	cfg := &ApiConfig{JWTSecret: secret}

	token, err := auth.MakeJWT(101, secret, 5*time.Minute)
	if err != nil {
		t.Fatalf("Token üretilemedi: %v", err)
	}

	protectedHandler := cfg.MiddleWareAuth(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Context().Value(UserIDKey).(int64)
		if userID != 101 {
			t.Errorf("Beklenen kullanıcı ID 101, gelen: %v", userID)
		}
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/v1/portfolio/summary", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: token})
	rr := httptest.NewRecorder()

	protectedHandler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Geçerli token ile istek 200 OK dönmeliydi! Gelen: %v", rr.Code)
	}
}
