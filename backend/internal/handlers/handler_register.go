package handlers

import (
	"encoding/json"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"
	"yarmak/internal/auth"
	"yarmak/internal/database"
)

// HandlerRegister, yeni bir kullanıcı hesabı oluşturur. Şifreyi bcrypt ile hash'leyip veritabanına kaydeder.
// @Summary Yeni Kullanıcı Kaydı
// @Description Yeni bir kullanıcı hesabı oluşturur
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body authRequest true "Kayıt Bilgileri"
// @Success 201 {object} database.User
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /register [post]
func (cfg *ApiConfig) HandlerRegister(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	parsedAddr, err := mail.ParseAddress(req.Email)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Lütfen geçerli bir e-posta adresi girin", err)
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(parsedAddr.Address))

	// En az 8 karakter (harf sayısı); bcrypt'in sınırı ise 72 bayt ve Türkçe harfler (ğ, ş, ı) 2 bayt sayılır.
	// Eskiden ikisi de bayt sayıyordu ama mesaj "karakter" diyordu: "şğüçöıİŞ" 8 harf olduğu hâlde 16 bayt (#23).
	if utf8.RuneCountInString(req.Password) < 8 {
		respondWithError(w, http.StatusBadRequest, "Şifre en az 8 karakter olmalıdır", nil)
		return
	}
	if len(req.Password) > 72 {
		respondWithError(w, http.StatusBadRequest, "Şifre çok uzun: en fazla 72 bayt olabilir (Türkçe harfler 2 bayt sayılır)", nil)
		return
	}

	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_]{3,15}$`)
	if !usernameRegex.MatchString(req.Username) {
		respondWithError(w, http.StatusBadRequest, "Kullanıcı adı 3-15 karakter olmalı; yalnızca harf, rakam ve alt çizgi (_) içerebilir", nil)
		return
	}
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Şifre işlenmedi", err)
		return
	}
	user, err := cfg.DB.CreateUser(r.Context(), database.CreateUserParams{Email: req.Email, PasswordHash: hashedPassword, Username: req.Username})
	if err != nil {
		if constraint, ok := uniqueViolation(err); ok {
			if constraint == "users_username_key" {
				respondWithError(w, http.StatusConflict, "Bu kullanıcı adı zaten kullanımda", err)
			} else {
				respondWithError(w, http.StatusConflict, "Bu e-posta adresi zaten kullanımda", err)
			}
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Kullanıcı kaydı oluşturulurken bir hata meydana geldi", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, userResponse{ID: user.ID, Email: user.Email, CreatedAt: user.CreatedAt, Role: user.Role, Username: user.Username})
}
