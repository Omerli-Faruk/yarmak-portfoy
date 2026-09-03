package handlers

import (
	"yarmak/internal/auth"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	protectedHandler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Geçerli token ile istek 200 OK dönmeliydi! Gelen: %v", rr.Code)
	}
}
