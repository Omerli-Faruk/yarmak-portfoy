package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"yarmak/internal/handlers"
)

// limiterKey, isteği clientIPMiddleware'den geçirip rate limiter'ın göreceği anahtarı döner.
func limiterKey(t *testing.T, trustedProxies, remoteAddr, realIP string) string {
	t.Helper()
	var key string
	handler := clientIPMiddleware(parseTrustedProxies(trustedProxies))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		k, err := keyByClientIP(r)
		if err != nil {
			t.Fatalf("keyByClientIP hata verdi: %v", err)
		}
		key = k
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/healthz", nil)
	req.RemoteAddr = remoteAddr
	if realIP != "" {
		req.Header.Set("X-Real-IP", realIP)
	}
	handler.ServeHTTP(httptest.NewRecorder(), req)
	return key
}

func TestClientIPKey(t *testing.T) {
	tests := []struct {
		name           string
		trustedProxies string
		remoteAddr     string
		realIP         string
		want           string
	}{
		{"yerel proxy başlığı iletir", "", "127.0.0.1:1", "203.0.113.5", "203.0.113.5"},
		{"IPv6 loopback de güvenilir", "", "[::1]:1", "203.0.113.5", "203.0.113.5"},
		{"dışarıdan gelen başlık yok sayılır", "", "198.51.100.7:1", "203.0.113.5", "198.51.100.7"},
		{"varsayılanda iç ağ güvenilir değil", "", "10.0.0.2:1", "203.0.113.5", "10.0.0.2"},
		{"başlık yoksa bağlantı adresi", "10.0.0.0/8", "10.0.0.2:1", "", "10.0.0.2"},
		{"güvenilen peer geçersiz başlık gönderirse bağlantı adresi", "", "127.0.0.1:1", "bozuk", "127.0.0.1"},
		{"TRUSTED_PROXIES ile eklenen ağ", "172.18.0.0/16", "172.18.0.1:1", "203.0.113.5", "203.0.113.5"},
		{"tek IP yazılabilir", "172.18.0.1", "172.18.0.1:1", "203.0.113.5", "203.0.113.5"},
		{"TRUSTED_PROXIES verilince loopback varsayılanı geçerli değil", "172.18.0.0/16", "127.0.0.1:1", "203.0.113.5", "127.0.0.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := limiterKey(t, tt.trustedProxies, tt.remoteAddr, tt.realIP)
			if got != tt.want {
				t.Errorf("anahtar = %q, beklenen %q", got, tt.want)
			}
		})
	}
}

func TestParseTrustedProxiesSkipsInvalid(t *testing.T) {
	got := parseTrustedProxies("10.0.0.0/8, yanlis, ::1/128")
	if len(got) != 2 {
		t.Fatalf("2 geçerli adres bekleniyordu, gelen: %v", got)
	}
}

func TestSwaggerEnabled(t *testing.T) {
	for raw, want := range map[string]bool{"": true, "true": true, "1": true, "bozuk": true, "false": false, "0": false} {
		if got := swaggerEnabled(raw); got != want {
			t.Errorf("swaggerEnabled(%q) = %v, beklenen %v", raw, got, want)
		}
	}
}

// Geçmiş veri indirmeyi tetikleyen uç giriş ister; çerezsiz istek handler'a ulaşmamalı.
func TestBackfillRequiresAuth(t *testing.T) {
	r := SetupRouter(&handlers.ApiConfig{JWTSecret: "test-secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/assets/1/backfill", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("beklenen 401, gelen %d", rec.Code)
	}
}
