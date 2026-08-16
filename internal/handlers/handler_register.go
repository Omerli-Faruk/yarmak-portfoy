package handlers

import (
	"borsa_portfoy_backend/internal/auth"
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
)

func (cfg *ApiConfig) HandlerRegister(w http.ResponseWriter, r *http.Request) {
	type reqRegister struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req reqRegister
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	_, err = mail.ParseAddress(req.Email)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Lütfen geçerli bir e-posta adresi girin", err)
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if len(req.Password) < 8 || len(req.Password) > 72 {
		respondWithError(w, http.StatusBadRequest, "Şifre 8 ile 72 karakter arasında olmalıdır", nil)
		return
	}
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Şifre işlenmedi", err)
		return
	}
	user, err := cfg.DB.CreateUser(r.Context(), database.CreateUserParams{Email: req.Email, PasswordHash: hashedPassword})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Bu e-posta adresi zaten kullanımda", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, userResponse{ID: user.ID, Email: user.Email, CreatedAt: user.CreatedAt, Role: user.Role})
}
