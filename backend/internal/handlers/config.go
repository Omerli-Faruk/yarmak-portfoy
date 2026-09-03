package handlers

import (
	"yarmak/internal/database"
	"database/sql"
)

type ApiConfig struct {
	DB        *database.Queries
	DBConn    *sql.DB
	JWTSecret string
}

