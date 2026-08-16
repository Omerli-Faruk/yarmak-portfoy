package handlers

import (
	"borsa_portfoy_backend/internal/auth"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (cfg *ApiConfig) HandlerLogin(w http.ResponseWriter, r *http.Request) {
	type reqLogin struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	type loginResponse struct {
		Token string       `json:"token"`
		User  userResponse `json:"user"`
	}
	decoder := json.NewDecoder(r.Body)
	params := reqLogin{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	email := strings.TrimSpace(params.Email)
	password := strings.TrimSpace(params.Password)
	if email == "" || password == "" {
		respondWithError(w, http.StatusBadRequest, "Lütfen tüm alanları doldurun", nil)
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
