package scraper

import (
	"borsa_portfoy_backend/internal/database"
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"time"
)

func StartScraperWorker(ctx context.Context, db *database.Queries, interval time.Duration) {
	go func() {
		slog.Info("Scraper worker başlatıldı", "interval", interval)
		for {
			select {
			case <-ctx.Done():
				slog.Info("Scraper worker temiz bir şekilde durduruldu")
				return
			default:
			}

			func() {
				defer func() {
					if r := recover(); r != nil {
						slog.Error("Scraper döngüsünde çökme (panic) yakalandı ve kurtarıldı", "panic", r)
					}
				}()
				runScrapeCycle(ctx, db)
			}()
			select {
			case <-ctx.Done():
				slog.Info("Scraper worker temiz bir şekilde durduruldu")
				return
			case <-time.After(interval):
			}
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

		oldPrice, _ := strconv.ParseFloat(asset.CurrentPrice, 64)
		if math.Abs(newPrice-oldPrice) > 0.000001 {
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
		}

		alerts, err := db.GetPendingAlertsForAsset(ctx, asset.ID)
		if err != nil {
			slog.Error("Fiyat alarmı sorgulanırken hata oluştu", "symbol", asset.Symbol, "error", err)
		}

		for _, alert := range alerts {
			targetPrice, _ := strconv.ParseFloat(alert.TargetPrice, 64)
			if (alert.Direction == "ABOVE" && newPrice >= targetPrice) || (alert.Direction == "BELOW" && newPrice <= targetPrice) {
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
