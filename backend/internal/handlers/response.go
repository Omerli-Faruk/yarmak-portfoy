package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func HandlerReadiness(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// respondWithJSON — Verilen payload'ı JSON'a çevirir ve belirtilen HTTP status code ile HTTP response'a yazar.
func respondWithJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	dat, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"Sunucu hatası oluştu"}`))
		return
	}
	w.WriteHeader(code)
	_, _ = w.Write(dat)
}

// respondWithError — API'de oluşan hataları standart bir JSON formatında (message objesi) kullanıcıya döner.
func respondWithError(w http.ResponseWriter, code int, msg string, err error) {
	if code > 499 {
		slog.Error(msg, "err", err)
	} else {
		slog.Warn(msg, "err", err)
	}
	respondWithJSON(w, code, map[string]string{"error": msg})
}
