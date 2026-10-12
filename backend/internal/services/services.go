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
	prices := NewScraperPriceSource()
	return &Services{
		Transaction: NewTransactionService(db, dbConn),
		Asset:       NewAssetService(db, prices),
		Portfolio:   NewPortfolioService(db, prices),
	}
}
