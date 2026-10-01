package services

import (
	"context"
	"fmt"
	"strings"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
)

type AssetService struct {
	DB *database.Queries
}

func NewAssetService(db *database.Queries) *AssetService {
	return &AssetService{DB: db}
}

func (s *AssetService) FetchPriceHistoryByRange(ctx context.Context, assetID int64, rangeParam string) ([]database.PriceHistory, error) {
	switch strings.ToUpper(strings.TrimSpace(rangeParam)) {
	case "1Y":
		cutoff := time.Now().AddDate(-1, 0, 0)
		return s.DB.GetAssetPriceHistoryWeekly(ctx, database.GetAssetPriceHistoryWeeklyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	case "ALL", "5Y":
		cutoff := time.Now().AddDate(-10, 0, 0)
		return s.DB.GetAssetPriceHistoryMonthly(ctx, database.GetAssetPriceHistoryMonthlyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	default:
		return s.DB.GetAssetPriceHistory(ctx, assetID)
	}
}

// GetOrCreateAssetBySymbol — Verilen sembole ait varlığı veritabanında arar, bulamazsa dış API'lerden (TEFAS, Yahoo vb.) çekip veritabanına ekler.
func (s *AssetService) GetOrCreateAssetBySymbol(ctx context.Context, symbol, assetType string) (database.Asset, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	assetType = strings.ToUpper(strings.TrimSpace(assetType))

	switch symbol {
	case "USD", "DOLAR":
		symbol = "USDTRY"
		assetType = "DOVIZ"
	case "EUR", "EURO":
		symbol = "EURTRY"
		assetType = "DOVIZ"
	case "GBP", "STERLIN":
		symbol = "GBPTRY"
		assetType = "DOVIZ"
	case "ALTIN", "GRAMALTIN", "GRAM":
		symbol = "ALTIN"
		assetType = "ALTIN"
	}
	asset, err := s.DB.GetAssetBySymbol(ctx, symbol)
	if err == nil {
		return asset, nil
	}
	var livePrice float64
	var fetchErr error
	if assetType == "HISSE" || assetType == "ALTIN" || assetType == "DOVIZ" {
		livePrice, fetchErr = scraper.FetchBISTPrice(symbol)
	} else if assetType == "FON" {
		livePrice, fetchErr = scraper.FetchTEFASPrice(symbol)
	} else {
		return database.Asset{}, fmt.Errorf("varlık piyasada bulunamadı: %s", symbol)
	}
	if fetchErr != nil {
		return database.Asset{}, fmt.Errorf("varlık fiyatı çekilemedi (%s): %w", symbol, fetchErr)
	}
	if livePrice <= 0 {
		return database.Asset{}, fmt.Errorf("varlık fiyatı 0 veya negatif (%s)", symbol)
	}
	priceStr := fmt.Sprintf("%.6f", livePrice)
	newAsset, err := s.DB.CreateAsset(ctx, database.CreateAssetParams{
		Symbol:       symbol,
		Name:         symbol,
		AssetType:    assetType,
		CurrentPrice: priceStr,
	})
	if err != nil {
		assetBySymbol, err := s.DB.GetAssetBySymbol(ctx, symbol)
		if err != nil {
			return database.Asset{}, fmt.Errorf("varlık veritabanına kaydedilemedi (%s): %w", symbol, err)
		}
		return assetBySymbol, nil
	}
	_, _ = s.DB.CreatePriceHistory(ctx, database.CreatePriceHistoryParams{
		AssetID:    newAsset.ID,
		Price:      priceStr,
		RecordedAt: time.Now().UTC(),
	})
	return newAsset, nil
}
