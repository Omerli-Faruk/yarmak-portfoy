package handlers

import (
	"net/http"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
)

// clearAuthCookies — Tarayıcıdaki access_token ve refresh_token çerezlerini derhal siler (MaxAge: -1).
func clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

// HandlerRefreshToken — refresh_token çerezinden yeni bir access/refresh token çifti üretir ve çerezlere yazar.
// Eski token iptal edilir; aynı anda gelen isteklerde oturum düşmesin diye 30 saniyelik tolerans vardır.
// @Summary Access Token Yenile (Refresh)
// @Description refresh_token çerezini kullanarak yeni tokenları çerez olarak döner
// @Tags Auth
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /refresh [post]
func (cfg *ApiConfig) HandlerRefreshToken(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		clearAuthCookies(w)
		respondWithError(w, http.StatusUnauthorized, "Refresh token bulunamadı", nil)
		return
	}
	refreshTokenValue := cookie.Value
	if refreshTokenValue == "" {
		respondWithError(w, http.StatusBadRequest, "Refresh token değeri boş", nil)
		return
	}

	// Token rotation transaction'ı: Eski token'ı iptal et ve yeni token çiftini oluştur
	tx, err := cfg.DBConn.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "İşlem başlatılamadı", err)
		return
	}
	defer func() { _ = tx.Rollback() }()

	qtx := cfg.DB.WithTx(tx)
	hashedToken := auth.HashToken(refreshTokenValue)

	rows, err := qtx.RevokeValidRefreshToken(r.Context(), hashedToken)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token yenilenirken hata oluştu", err)
		return
	}

	var userID int64
	if rows == 0 {
		// Grace period (30 sn): Eşzamanlı paralel isteklerde token henüz yenilendiyse oturumu düşürme.
		// Bu sayede, aynı anda gelen isteklerde sadece ilk istek token'ı yeniler, diğerleri 30 saniye içinde
		// bu tolerans aralığından yararlanır.
		userID, err = qtx.GetUserFromRecentlyRevokedToken(r.Context(), hashedToken)
		if err != nil {
			clearAuthCookies(w)
			respondWithError(w, http.StatusUnauthorized, "Geçersiz, süresi dolmuş veya daha önce kullanılmış token", nil)
			return
		}
	} else {
		userID, err = qtx.GetUserIDFromRefreshToken(r.Context(), hashedToken)
		if err != nil {
			clearAuthCookies(w)
			respondWithError(w, http.StatusUnauthorized, "Kullanıcı bulunamadı", err)
			return
		}
	}

	accessToken, err := auth.MakeJWT(userID, cfg.JWTSecret, 1*time.Hour)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token üretilemedi", err)
		return
	}

	newRefreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Yeni token oluşturulurken hata oluştu", err)
		return
	}

	_, err = qtx.CreateRefreshToken(r.Context(), database.CreateRefreshTokenParams{
		Token:     auth.HashToken(newRefreshToken),
		UserID:    userID,
		ExpiresAt: time.Now().Add(60 * 24 * time.Hour),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token veritabanına kaydedilemedi", err)
		return
	}

	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "İşlem onaylanamadı", err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 24 * 3600,
	})

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Oturum yenilendi"})
}

// HandlerRevokeToken — Logout sırasında refresh token'ı DB'de iptal eder ve cookie'leri temizler.
// @Summary Oturumu Kapat / Token İptal Et (Revoke)
// @Description Kullanıcının refresh token'ını iptal ederek oturumunu kapatır (Logout)
// @Tags Auth
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /revoke [post]
func (cfg *ApiConfig) HandlerRevokeToken(w http.ResponseWriter, r *http.Request) {
	// Her durumda istemci tarafındaki auth çerezlerini temizle
	clearAuthCookies(w)

	cookie, err := r.Cookie("refresh_token")
	if err == nil && cookie.Value != "" {
		_ = cfg.DB.RevokeRefreshToken(r.Context(), auth.HashToken(cookie.Value))
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Oturum başarıyla kapatıldı"})
}
