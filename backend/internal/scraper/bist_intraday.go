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

func isWeekend(now time.Time) bool {
	return now.Weekday() == time.Saturday || now.Weekday() == time.Sunday
}

func isBistMarketHours(now time.Time) bool {
	return !isWeekend(now) && now.Hour() >= 10 && (now.Hour() < 18 || (now.Hour() == 18 && now.Minute() <= 15))
}

// isFxMarketOpen, döviz ve altın piyasasının açık olup olmadığını söyler.
// İkisi de hafta içi neredeyse kesintisiz işlem gördüğü için BIST seansına bağlı değildir.
func isFxMarketOpen(now time.Time) bool {
	return !isWeekend(now)
}

func isFxAsset(assetType string) bool {
	return assetType == "DOVIZ" || assetType == "ALTIN"
}

// shouldRunCycle, piyasa açıksa her tikte, kapalıysa son turdan offHoursInterval geçtiyse true döner.
// assets.updated_at'e bakılmaz: fiyat değişmeyince güncellenmediği için hafta sonu her tik bayat sayılıyordu.
func shouldRunCycle(marketOpen bool, now, lastRun time.Time) bool {
	if marketOpen {
		return true
	}
	return now.Sub(lastRun) >= offHoursInterval
}

func StartBistIntradayWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	wg.Go(func() {
		slog.Info("BIST Intraday worker başlatıldı")

		// Sunucu ilk açıldığında hemen bir kez çalıştır
		lastStockRun := time.Now()
		lastFxRun := lastStockRun
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("BIST İlk açılış döngüsünde panic yakalandı", "panic", r)
				}
			}()
			runBistCycle(ctx, db, true, true)
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
				runStocks := shouldRunCycle(isBistMarketHours(now), now, lastStockRun)
				runFx := shouldRunCycle(isFxMarketOpen(now), now, lastFxRun)
				if !runStocks && !runFx {
					continue
				}
				if runStocks {
					lastStockRun = now
				}
				if runFx {
					lastFxRun = now
				}

				func() {
					defer func() {
						if r := recover(); r != nil {
							slog.Error("BIST Intraday döngüsünde panic yakalandı", "panic", r)
						}
					}()
					runBistCycle(ctx, db, runStocks, runFx)
				}()
			}
		}
	})
}

// runBistCycle, aktif varlıkların fiyatını günceller. stocks hisseleri, fx döviz ve altını kapsar.
func runBistCycle(ctx context.Context, db *database.Queries, stocks, fx bool) {
	slog.Info("BIST fiyat taraması başlatılıyor", "stocks", stocks, "fx", fx)
	assets, err := db.GetActiveAssets(ctx)
	if err != nil {
		slog.Error("Aktif hisseler çekilemedi", "error", err)
		return
	}

	for _, asset := range assets {
		if asset.AssetType == "FON" {
			continue // Fon fiyatları TEFAS günlük döngüsünde güncellenir
		}
		if isFxAsset(asset.AssetType) {
			if !fx {
				continue
			}
		} else if !stocks {
			continue
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
