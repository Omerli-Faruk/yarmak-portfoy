package services

import (
	"database/sql"
	"yarmak/internal/database"
)

type Services struct {
	Transaction *TransactionService
	Asset       *AssetService
	Portfolio   *PortfolioService
}

func NewServices(db *database.Queries, dbConn *sql.DB) *Services {
	return &Services{
		Transaction: NewTransactionService(db, dbConn),
		Asset:       NewAssetService(db),
		Portfolio:   NewPortfolioService(db),
	}
}
