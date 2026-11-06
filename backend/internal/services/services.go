package services

import (
	"database/sql"
	"yarmak/internal/database"
)

type Services struct {
	Transaction *TransactionService
	Asset       *AssetService
	Portfolio   *PortfolioService
	// Prices, dış fiyat kaynaklarına giden tek kapı (önbellek, singleflight, hız sınırı, devre kesici).
	Prices PriceSource
}

func NewServices(db *database.Queries, dbConn *sql.DB) *Services {
	// Bütün servisler aynı kapıyı paylaşır; böylece önbellek ve hız sınırı uygulama genelinde tek olur.
	prices := NewGatedPriceSource(NewScraperPriceSource(), DefaultGateConfig())
	return &Services{
		Transaction: NewTransactionService(db, dbConn),
		Asset:       NewAssetService(db, prices),
		Portfolio:   NewPortfolioService(db, prices),
		Prices:      prices,
	}
}
