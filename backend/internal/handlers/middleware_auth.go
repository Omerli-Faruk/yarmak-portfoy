package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"yarmak/internal/auth"
)

func (cfg *ApiConfig) MiddleWareAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		cookie, err := r.Cookie("access_token")
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Giriş yapmanız gerekiyor (Token eksik)", nil)
			return
		}
		tokenString := cookie.Value
		userID, err := auth.ValidateJWT(tokenString, cfg.JWTSecret)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Geçersiz veya süresi dolmuş token", nil)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}

func (cfg *ApiConfig) MiddleWareAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value(UserIDKey).(int64)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
			return
		}
		user, err := cfg.DB.GetUserByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				respondWithError(w, http.StatusUnauthorized, "Kullanıcı bulunamadı", nil)
				return
			}
			respondWithError(w, http.StatusInternalServerError, "Kullanıcı bulunamadı", nil)
			return
		}
		if user.Role != "ADMIN" {
			respondWithError(w, http.StatusForbidden, "Bu işlem için yönetici yetkisi gereklidir", nil)
			return
		}
		next(w, r)
	}
}
