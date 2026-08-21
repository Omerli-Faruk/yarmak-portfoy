package handlers

import (
	"borsa_portfoy_backend/internal/auth"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type reqLogin struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"Secret1234"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

// @Summary Kullanıcı Girişi
// @Description Email ve şifre ile giriş yapıp JWT token üretir
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body reqLogin true "Kullanıcı Giriş Bilgileri"
// @Success 200 {object} loginResponse
// @Failure 400 {object} map[string]string
// @Router /login [post]
func (cfg *ApiConfig) HandlerLogin(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := reqLogin{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	email := strings.ToLower(strings.TrimSpace(params.Email))
	password := strings.TrimSpace(params.Password)
	if email == "" || password == "" {
		respondWithError(w, http.StatusBadRequest, "Lütfen tüm alanları doldurun", nil)
		return
	}
	if len(password) > 72 {
		respondWithError(w, http.StatusBadRequest, "Şifre en fazla 72 karakter olabilir", nil)
		return
	}
	user, err := cfg.DB.GetUserByEmail(r.Context(), email)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Geçersiz e-posta veya şifre", err)
		return
	}
	ok := auth.CheckPasswordHash(password, user.PasswordHash)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Geçersiz e-posta veya şifre", nil)
		return
	}
	token, err := auth.MakeJWT(user.ID, cfg.JWTSecret, 15*time.Minute)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token oluşturulurken hata oluştu", err)
		return
	}
	respondWithJSON(w, http.StatusOK, loginResponse{Token: token, User: userResponse{ID: user.ID, Email: user.Email, CreatedAt: user.CreatedAt, Role: user.Role}})
}
