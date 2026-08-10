package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func respondWithJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	dat, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(500)
		return
	}
	w.WriteHeader(code)
	_, _ = w.Write(dat)
}

func respondWithError(w http.ResponseWriter, code int, msg string, err error) {
	slog.Error(msg, "err", err)
	respondWithJSON(w, code, map[string]string{"error": msg})
}
