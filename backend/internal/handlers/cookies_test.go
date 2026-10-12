package handlers

import (
	"net/http/httptest"
	"testing"
)

// Secure bayrağı, çerezlerin yazıldığı ve silindiği her yerde COOKIE_SECURE ayarına uymalı.
func TestAuthCookiesSecureFlag(t *testing.T) {
	for _, secure := range []bool{false, true} {
		cfg := &ApiConfig{CookieSecure: secure}
		set := httptest.NewRecorder()
		cfg.setAuthCookies(set, "a", "r")
		cleared := httptest.NewRecorder()
		cfg.clearAuthCookies(cleared)

		cookies := append(set.Result().Cookies(), cleared.Result().Cookies()...)
		if len(cookies) != 4 {
			t.Fatalf("4 çerez bekleniyordu, %d geldi", len(cookies))
		}
		for _, c := range cookies {
			if c.Secure != secure || !c.HttpOnly {
				t.Errorf("secure=%v iken %s çerezi Secure=%v HttpOnly=%v", secure, c.Name, c.Secure, c.HttpOnly)
			}
		}
	}
}
