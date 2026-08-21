package handlers

import (
	"borsa_portfoy_backend/internal/auth"
	"encoding/json"
	"net/http"
	"time"
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
	decoder := json.NewDecoder(r.Body)
	params := refreshTokenRequest{}
	err := decoder.Decode(&params)
	if err != nil || params.RefreshToken == "" {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}

	user, err := cfg.DB.GetUserFromRefreshToken(r.Context(), params.RefreshToken)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Geçersiz veya süresi dolmuş refresh token", err)
		return
	}

	accessToken, err := auth.MakeJWT(user.ID, cfg.JWTSecret, 15*time.Minute)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token üretilemedi", err)
		return
	}

	respondWithJSON(w, http.StatusOK, refreshTokenResponse{Token: accessToken})
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
	decoder := json.NewDecoder(r.Body)
	params := refreshTokenRequest{}
	err := decoder.Decode(&params)
	if err != nil || params.RefreshToken == "" {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}

	err = cfg.DB.RevokeRefreshToken(r.Context(), params.RefreshToken)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Token iptal edilemedi", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Oturum başarıyla kapatıldı"})
}
