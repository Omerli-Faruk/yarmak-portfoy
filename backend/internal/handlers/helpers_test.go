package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"yarmak/internal/services"

	"github.com/lib/pq"
)

// #10: geçmişi dönemin başına uzanmayan varlıkta o dönem cevapta olmamalı; %0 "değişmedi" demek olur.
func TestPeriodReturnsOmitsPeriodsWithoutBasePrice(t *testing.T) {
	got := periodReturns(110, map[string]float64{
		"1Y":  100, // 1 yıl önce 100 → %10
		"3Y":  0,   // geçmiş 3 yıla uzanmıyor
		"ALL": 50,  // ilk kayıt 50 → %120
	})

	if r, ok := got["1Y"]; !ok || r < 9.99 || r > 10.01 {
		t.Errorf("1Y = %v (var mı: %v), beklenen %%10", r, ok)
	}
	if r, ok := got["ALL"]; !ok || r < 119.99 || r > 120.01 {
		t.Errorf("ALL = %v (var mı: %v), beklenen %%120", r, ok)
	}
	if r, ok := got["3Y"]; ok {
		t.Errorf("3Y için veri yok, cevapta olmamalıydı; gelen %v", r)
	}
}

func TestPeriodReturnsEmptyWithoutCurrentPrice(t *testing.T) {
	if got := periodReturns(0, map[string]float64{"1Y": 100}); len(got) != 0 {
		t.Errorf("güncel fiyat yokken getiri hesaplanmamalı, gelen %v", got)
	}
}

// #22: kullanıcı hatası mesajına göre değil tipine göre tanınmalı; sarmalansa da bulunmalı.
func TestAsUserErrorFindsWrappedError(t *testing.T) {
	err := fmt.Errorf("işlem eklenemedi: %w", &services.UserError{Msg: "Yetersiz bakiye"})
	if ue, ok := asUserError(err); !ok || ue.Msg != "Yetersiz bakiye" {
		t.Errorf("sarmalanmış UserError bulunmalıydı, gelen %v, %v", ue, ok)
	}
	if _, ok := asUserError(errors.New("pq: bağlantı koptu")); ok {
		t.Error("veritabanı hatası kullanıcı hatası sayılmamalı (500 dönmeli)")
	}
}

// #22: benzersizlik ihlali hata metninden değil Postgres kodundan (23505) ve kısıt adından tanınmalı.
func TestUniqueViolation(t *testing.T) {
	err := fmt.Errorf("kayıt: %w", &pq.Error{Code: "23505", Constraint: "users_username_key"})
	if c, ok := uniqueViolation(err); !ok || c != "users_username_key" {
		t.Errorf("23505 tanınmalıydı, gelen %q, %v", c, ok)
	}
	if _, ok := uniqueViolation(&pq.Error{Code: "23503"}); ok {
		t.Error("yabancı anahtar ihlali (23503) benzersizlik sayılmamalı")
	}
}

// #23: uzunluk karakterle sayılmalı. 7 Türkçe harf 14 bayt; eskiden "8 karakter" kuralını geçiyordu.
func TestRegisterPasswordLengthCountsCharacters(t *testing.T) {
	cfg := &ApiConfig{JWTSecret: "test-secret"}
	tests := []struct {
		name, password string
	}{
		{"7 Türkçe harf (14 bayt)", "şğüçöıİ"},
		{"73 bayt", strings.Repeat("a", 73)},
	}
	for _, tt := range tests {
		body := `{"email":"a@example.com","username":"deneme","password":"` + tt.password + `"}`
		rr := httptest.NewRecorder()
		cfg.HandlerRegister(rr, httptest.NewRequest(http.MethodPost, "/v1/register", strings.NewReader(body)))
		if rr.Code != http.StatusBadRequest {
			t.Errorf("%s: 400 bekleniyordu, gelen %d", tt.name, rr.Code)
		}
	}
}
