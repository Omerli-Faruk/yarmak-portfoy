package handlers

import (
	"database/sql"
	"yarmak/internal/database"
)

type ApiConfig struct {
	DB        *database.Queries
	DBConn    *sql.DB
	JWTSecret string
}
