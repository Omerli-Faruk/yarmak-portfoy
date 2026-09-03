package handlers

import (
	"yarmak/internal/auth"
	"yarmak/internal/database"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
)

// @Summary Yeni Kullanıcı Kaydı
// @Description Sisteme yeni bir kullanıcı kaydeder
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body authRequest true "Kullanıcı Kayıt Bilgileri"
// @Success 201 {object} userResponse
// @Failure 400 {object} map[string]string
// @Router /register [post]
func (cfg *ApiConfig) HandlerRegister(w http.ResponseWriter, r *http.Request) {
	var req authRequest
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
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	if len(req.Username) < 3 || len(req.Username) > 15 {
		respondWithError(w, http.StatusBadRequest, "Kullanıcı adı 3 ile 15 karakter arasında olmalıdır", nil)
		return
	}
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Şifre işlenmedi", err)
		return
	}
	user, err := cfg.DB.CreateUser(r.Context(), database.CreateUserParams{Email: req.Email, PasswordHash: hashedPassword, Username: req.Username})
	if err != nil {
		if strings.Contains(err.Error(), "users_username_key") {
			respondWithError(w, http.StatusBadRequest, "Bu kullanıcı adı zaten kullanımda", err)
			return
		}
		respondWithError(w, http.StatusBadRequest, "Bu e-posta adresi zaten kullanımda", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, userResponse{ID: user.ID, Email: user.Email, CreatedAt: user.CreatedAt, Role: user.Role, Username: user.Username})
}
