package handlers

import (
	"database/sql"
	"yarmak/internal/database"
	"yarmak/internal/services"

	"github.com/go-chi/httprate"
)

type ApiConfig struct {
	DB        *database.Queries
	DBConn    *sql.DB
	JWTSecret string
	// CookieSecure, oturum çerezlerine Secure bayrağı ekler (COOKIE_SECURE=true). HTTPS arkasında açılmalı.
	CookieSecure bool
	Services     *services.Services
	// DiscoveryLimiter, sistemde olmayan sembollerin dış kaynaklardan aranmasını kullanıcı başına sınırlar. nil ise sınır yok.
	DiscoveryLimiter *httprate.RateLimiter
}
