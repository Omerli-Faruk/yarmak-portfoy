package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"database/sql"
)

type ApiConfig struct {
	DB        *database.Queries
	DBConn    *sql.DB
	JWTSecret string
}

