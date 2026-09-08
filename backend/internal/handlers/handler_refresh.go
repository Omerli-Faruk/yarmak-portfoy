package handlers

import (
	"net/http"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
)

// @Summary Access Token Yenile (Refresh)
// @Description Süresi dolan access token yerine refresh token kullanarak yeni bir access token üretir
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body refreshTokenRequest true "Refresh Token Bilgisi"
// @Success 200 {object} refreshTokenResponse
// @Failure 401 {object} map[string]string
// @Router /refresh [post]
func (cfg *ApiConfig) HandlerRefreshToken(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Refresh token bulunamadı", nil)
		return
	}
	refreshTokenValue := cookie.Value
	if err != nil || refreshTokenValue == "" {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	tx, err := cfg.DBConn.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "İşlem başlatılamadı", err)
		return
	}
	defer func() { _ = tx.Rollback() }()

	hashedToken := auth.HashToken(refreshTokenValue)
	res, err := tx.ExecContext(r.Context(), `
 	UPDATE refresh_tokens 
 	SET revoked_at = NOW(), updated_at = NOW() 
 	WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()
 `, hashedToken)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token yenilenirken hata oluştu", err)
		return
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		respondWithError(w, http.StatusUnauthorized, "Geçersiz, süresi dolmuş veya daha önce kullanılmış token", nil)
		return
	}

	var userID int64
	err = tx.QueryRowContext(r.Context(), `SELECT user_id FROM refresh_tokens WHERE token = $1`, hashedToken).Scan(&userID)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Kullanıcı bulunamadı", err)
		return
	}

	accessToken, err := auth.MakeJWT(userID, cfg.JWTSecret, 15*time.Minute)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token üretilemedi", err)
		return
	}

	newRefreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Yeni token oluşturulurken hata oluştu", err)
		return
	}

	qtx := cfg.DB.WithTx(tx)
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
		MaxAge:   3600 * 24 * 60,
	})

	respondWithJSON(w, http.StatusOK, refreshTokenResponse{
		Token:        accessToken,
		RefreshToken: newRefreshToken,
	})
}

// @Summary Oturumu Kapat / Token İptal Et (Revoke)
// @Description Kullanıcının refresh token'ını iptal ederek oturumunu kapatır (Logout)
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body refreshTokenRequest true "İptal Edilecek Refresh Token"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /revoke [post]
func (cfg *ApiConfig) HandlerRevokeToken(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Refresh token bulunamadı", nil)
		return
	}
	refreshTokenValue := cookie.Value
	if err != nil || refreshTokenValue == "" {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}

	err = cfg.DB.RevokeRefreshToken(r.Context(), auth.HashToken(refreshTokenValue))
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token iptal edilemedi", err)
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "access_token", Value: "", Path: "/", HttpOnly: true, MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: "refresh_token", Value: "", Path: "/", HttpOnly: true, MaxAge: -1})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Oturum başarıyla kapatıldı"})
}
