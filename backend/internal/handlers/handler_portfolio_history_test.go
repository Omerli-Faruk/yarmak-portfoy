package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Geçersiz aralık veritabanına gitmeden 400 döner.
func TestValueHistoryRejectsInvalidRange(t *testing.T) {
	cfg := &ApiConfig{JWTSecret: "test-secret"}
	for _, rng := range []string{"ALL", "2Y", "max"} {
		req := httptest.NewRequest("GET", "/v1/portfolio/value-history?range="+rng, nil)
		req = req.WithContext(context.WithValue(req.Context(), UserIDKey, int64(101)))
		rr := httptest.NewRecorder()
		cfg.HandlerGetPortfolioValueHistory(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Errorf("range=%s için 400 bekleniyordu, gelen: %v", rng, rr.Code)
		}
	}
}

func TestValueHistoryRequiresUser(t *testing.T) {
	cfg := &ApiConfig{JWTSecret: "test-secret"}
	req := httptest.NewRequest("GET", "/v1/portfolio/value-history", nil)
	rr := httptest.NewRecorder()
	cfg.MiddleWareAuth(cfg.HandlerGetPortfolioValueHistory).ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("token olmadan 401 bekleniyordu, gelen: %v", rr.Code)
	}
}
