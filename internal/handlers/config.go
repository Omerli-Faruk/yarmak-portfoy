package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"database/sql"
	"time"
)

type ApiConfig struct {
	DB        *database.Queries
	DBConn    *sql.DB
	JWTSecret string
}

type userResponse struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}
