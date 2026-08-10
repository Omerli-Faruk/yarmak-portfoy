package handlers

import "net/http"

func (cfg *ApiConfig) HandlerGetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	dbUser, err := cfg.DB.GetUserByID(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Kullanıcı bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, userResponse{
		ID:        dbUser.ID,
		Email:     dbUser.Email,
		CreatedAt: dbUser.CreatedAt,
	})
}
