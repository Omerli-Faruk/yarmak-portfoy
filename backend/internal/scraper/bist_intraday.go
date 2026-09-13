package scraper

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"sync"
	"time"
	"yarmak/internal/database"
)

func StartBistIntradayWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		slog.Info("BIST Intraday worker başlatıldı")
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("BIST Intraday worker durduruldu")
				return
			case <-ticker.C:
				now := time.Now()
				// Only run between 09:30 and 18:15 on weekdays
				if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
					continue
				}
				// BIST sürekli işlem saatleri 10:00 - 18:00 (18:10 kapanış marjı)
				if now.Hour() < 10 || now.Hour() > 18 || (now.Hour() == 18 && now.Minute() > 15) {
					continue
				}

				func() {
					defer func() {
						if r := recover(); r != nil {
							slog.Error("BIST Intraday döngüsünde panic yakalandı", "panic", r)
						}
					}()
					runBistCycle(ctx, db)
				}()
			}
		}
	}()
}

func runBistCycle(ctx context.Context, db *database.Queries) {
	slog.Info("BIST Intraday canlı fiyat taraması başlatılıyor...")
	assets, err := db.GetActiveAssets(ctx)
	if err != nil {
		slog.Error("Aktif hisseler çekilemedi", "error", err)
		return
	}

	for _, asset := range assets {
		if asset.AssetType == "FON" {
			continue // Handled by TEFAS daily worker
		}

		newPrice, fetchErr := FetchBISTPrice(asset.Symbol)
		if fetchErr != nil {
			slog.Error("BIST fiyat çekilemedi", "symbol", asset.Symbol, "error", fetchErr)
			continue
		}

		priceStr := fmt.Sprintf("%.6f", newPrice)
		oldPrice, _ := strconv.ParseFloat(asset.CurrentPrice, 64)

		if math.Abs(newPrice-oldPrice) > 0.000001 {
			_, err := db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
				ID:           asset.ID,
				CurrentPrice: priceStr,
			})
			if err != nil {
				continue
			}
			err = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
				AssetID:    asset.ID,
				Price:      priceStr,
				RecordedAt: time.Now().UTC(),
			})
			if err != nil {
				slog.Error("BIST fiyat geçmişi kaydedilemedi", "symbol", asset.Symbol, "error", err)
			} else {
				slog.Info("BIST fiyat başarıyla güncellendi", "symbol", asset.Symbol, "price", priceStr)
			}
		}
		
		checkAndTriggerAlerts(ctx, db, asset, newPrice, priceStr)
	}
	slog.Info("BIST Intraday taraması tamamlandı")
}
