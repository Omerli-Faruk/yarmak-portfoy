package handlers

import "net/http"

const (
	accessTokenMaxAge  = 3600
	refreshTokenMaxAge = 60 * 24 * 3600
)

// authCookie, oturum çerezlerinin ortak ayarları. Secure, COOKIE_SECURE ile açılır (bkz. ApiConfig.CookieSecure).
func (cfg *ApiConfig) authCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	}
}

// setAuthCookies, giriş ve yenilemede access/refresh token çerezlerini yazar.
func (cfg *ApiConfig) setAuthCookies(w http.ResponseWriter, accessToken, refreshToken string) {
	http.SetCookie(w, cfg.authCookie("access_token", accessToken, accessTokenMaxAge))
	http.SetCookie(w, cfg.authCookie("refresh_token", refreshToken, refreshTokenMaxAge))
}

// clearAuthCookies, tarayıcıdaki oturum çerezlerini hemen siler (MaxAge: -1).
func (cfg *ApiConfig) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, cfg.authCookie("access_token", "", -1))
	http.SetCookie(w, cfg.authCookie("refresh_token", "", -1))
}
