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

// Seans dışında tarama en fazla bu aralıkla yapılır (döviz/altın ve kaçırılmış kapanışlar için)
const offHoursInterval = 4 * time.Hour

func isBistMarketHours(now time.Time) bool {
	isWeekend := now.Weekday() == time.Saturday || now.Weekday() == time.Sunday
	return !isWeekend && now.Hour() >= 10 && (now.Hour() < 18 || (now.Hour() == 18 && now.Minute() <= 15))
}

// shouldRunCycle, seans içinde her tikte, seans dışında son turdan offHoursInterval geçtiyse true döner.
// assets.updated_at'e bakılmaz: fiyat değişmeyince güncellenmediği için hafta sonu her tik bayat sayılıyordu.
func shouldRunCycle(now, lastRun time.Time) bool {
	if isBistMarketHours(now) {
		return true
	}
	return now.Sub(lastRun) >= offHoursInterval
}

func StartBistIntradayWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		slog.Info("BIST Intraday worker başlatıldı")

		// Sunucu ilk açıldığında hemen bir kez çalıştır
		lastRun := time.Now()
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("BIST İlk açılış döngüsünde panic yakalandı", "panic", r)
				}
			}()
			runBistCycle(ctx, db)
		}()

		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("BIST Intraday worker durduruldu")
				return
			case <-ticker.C:
				loc, _ := time.LoadLocation("Europe/Istanbul")
				now := time.Now().In(loc)
				if !shouldRunCycle(now, lastRun) {
					continue
				}
				lastRun = now

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
	slog.Info("BIST fiyat taraması başlatılıyor")
	assets, err := db.GetActiveAssets(ctx)
	if err != nil {
		slog.Error("Aktif hisseler çekilemedi", "error", err)
		return
	}

	for _, asset := range assets {
		if asset.AssetType == "FON" {
			continue // Fon fiyatları TEFAS günlük döngüsünde güncellenir
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
