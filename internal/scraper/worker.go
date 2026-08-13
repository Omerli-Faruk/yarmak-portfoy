package scraper

import (
	"borsa_portfoy_backend/internal/database"
	"borsa_portfoy_backend/internal/handlers"
	"context"
	"fmt"
	"log/slog"
	"time"
)

func StartScraperWorker(cfg *handlers.ApiConfig, interval time.Duration) {
	go func() {
		ctx := context.Background()

		runScrapeCycle(ctx, cfg)

		ticker := time.NewTicker(interval)
		for range ticker.C {
			runScrapeCycle(ctx, cfg)
		}
	}()
}

func runScrapeCycle(ctx context.Context, cfg *handlers.ApiConfig) {
	slog.Info("Canlı fiyat taraması başlatılıyor...")
	assets, err := cfg.DB.ListAssets(ctx)
	if err != nil {
		slog.Error("Hisseler çekilemedi", "error", err)
		return
	}

	for _, asset := range assets {
		var newPrice float64
		var fetchErr error

		if asset.AssetType == "HISSE" || asset.AssetType == "ALTIN" || asset.AssetType == "DOVIZ" {
			newPrice, fetchErr = FetchBISTPrice(asset.Symbol)
		} else if asset.AssetType == "FON" {
			newPrice, fetchErr = FetchTEFASPrice(asset.Symbol)
		} else {
			continue
		}

		if fetchErr != nil {
			slog.Error("Fiyat çekilemedi", "symbol", asset.Symbol, "error", fetchErr)
			continue
		}

		priceStr := fmt.Sprintf("%.6f", newPrice)

		_, err = cfg.DB.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
			ID:           asset.ID,
			CurrentPrice: priceStr,
		})
		if err != nil {
			slog.Error("Fiyat veritabanında güncellenemedi", "symbol", asset.Symbol, "error", err)
			continue
		}

		_, err = cfg.DB.CreatePriceHistory(ctx, database.CreatePriceHistoryParams{
			AssetID:    asset.ID,
			Price:      priceStr,
			RecordedAt: time.Now().UTC(),
		})
		if err != nil {
			slog.Error("Fiyat geçmişi kaydedilemedi", "symbol", asset.Symbol, "error", err)
		} else {
			slog.Info("Fiyat başarıyla güncellendi", "symbol", asset.Symbol, "price", priceStr)
		}
	}
}
