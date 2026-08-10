package handlers

import (
	"borsa_portfoy_backend/internal/auth"
	"context"
	"net/http"
	"strings"
)

func (cfg *ApiConfig) MiddleWareAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		userID, err := auth.ValidateJWT(tokenString, cfg.JWTSecret)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Geçersiz veya süresi dolmuş token", err)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}
