package scraper

import (
	"borsa_portfoy_backend/internal/database"
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"
)

func StartScraperWorker(db *database.Queries, interval time.Duration) {
	go func() {
		ctx := context.Background()

		runScrapeCycle(ctx, db)

		ticker := time.NewTicker(interval)
		for range ticker.C {
			runScrapeCycle(ctx, db)
		}
	}()
}

func runScrapeCycle(ctx context.Context, db *database.Queries) {
	slog.Info("Canlı fiyat taraması başlatılıyor...")
	assets, err := db.ListAssets(ctx)
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

		_, err = db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
			ID:           asset.ID,
			CurrentPrice: priceStr,
		})
		if err != nil {
			slog.Error("Fiyat veritabanında güncellenemedi", "symbol", asset.Symbol, "error", err)
			continue
		}

		_, err = db.CreatePriceHistory(ctx, database.CreatePriceHistoryParams{
			AssetID:    asset.ID,
			Price:      priceStr,
			RecordedAt: time.Now().UTC(),
		})
		if err != nil {
			slog.Error("Fiyat geçmişi kaydedilemedi", "symbol", asset.Symbol, "error", err)
		} else {
			slog.Info("Fiyat başarıyla güncellendi", "symbol", asset.Symbol, "price", priceStr)
		}

		alerts, err := db.GetPendingAlertsForAsset(ctx, asset.ID)
		if err != nil {
			slog.Error("Fiyat alarmı sorgulanırken hata oluştu", "symbol", asset.Symbol, "error", err)
		}

		for _, alert := range alerts {
			targetPrice, _ := strconv.ParseFloat(alert.TargetPrice, 64)
			if alert.Direction == "ABOVE" && newPrice >= targetPrice || alert.Direction == "BELOW" && newPrice <= targetPrice {
				err = db.MarkAlertTriggered(ctx, alert.ID)
				if err != nil {
					slog.Error("Fiyat alarmı durumu güncellenirken hata oluştu", "symbol", asset.Symbol, "error", err)
				}
				slog.Warn("🚨 FİYAT ALARMI TETİKLENDİ!",
					"symbol", asset.Symbol,
					"direction", alert.Direction,
					"target_price", alert.TargetPrice,
					"current_price", priceStr,
					"user_id", alert.UserID,
				)
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
}
