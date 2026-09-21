package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
)

// @Summary Kullanıcı Girişi
// @Description E-posta veya kullanıcı adı ve şifre ile giriş yapıp JWT token üretir
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body authRequest true "Kullanıcı Giriş Bilgileri"
// @Success 200 {object} loginResponse
// @Failure 400 {object} map[string]string
// @Router /login [post]
func (cfg *ApiConfig) HandlerLogin(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := authRequest{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	identifier := strings.ToLower(strings.TrimSpace(params.Email))
	if identifier == "" && params.Username != "" {
		identifier = strings.ToLower(strings.TrimSpace(params.Username))
	}
	password := params.Password
	if identifier == "" || password == "" {
		respondWithError(w, http.StatusBadRequest, "Lütfen tüm alanları doldurun", nil)
		return
	}
	if len(password) > 72 {
		respondWithError(w, http.StatusBadRequest, "Şifre en fazla 72 karakter olabilir", nil)
		return
	}
	var user database.User
	if strings.Contains(identifier, "@") {
		user, err = cfg.DB.GetUserByEmail(r.Context(), identifier)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Geçersiz e-posta veya şifre", err)
			return
		}
	} else {
		user, err = cfg.DB.GetUserByUsername(r.Context(), identifier)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Geçersiz kullanıcı adı veya şifre", err)
			return
		}
	}
	ok := auth.CheckPasswordHash(password, user.PasswordHash)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Geçersiz e-posta veya şifre", nil)
		return
	}
	token, err := auth.MakeJWT(user.ID, cfg.JWTSecret, 30*24*time.Hour)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token oluşturulurken hata oluştu", err)
		return
	}
	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Refresh token oluşturulamadı", err)
		return
	}
	_, err = cfg.DB.CreateRefreshToken(r.Context(), database.CreateRefreshTokenParams{
		Token:     auth.HashToken(refreshToken),
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(90 * 24 * time.Hour),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Refresh token kaydedilemedi", err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   90 * 24 * 3600,
	})
	respondWithJSON(w, http.StatusOK, loginResponse{
		Token:        token,
		RefreshToken: refreshToken,
		User: userResponse{
			ID:        user.ID,
			Email:     user.Email,
			Username:  user.Username,
			CreatedAt: user.CreatedAt,
			Role:      user.Role,
		},
	})
}
