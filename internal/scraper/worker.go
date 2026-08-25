package scraper

import (
	"borsa_portfoy_backend/internal/database"
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"sync"
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
	startTime := time.Now()
	assets, err := db.ListAssets(ctx)
	if err != nil {
		slog.Error("Hisseler çekilemedi", "error", err)
		return
	}
	jobs := make(chan database.Asset, len(assets))
	var wg sync.WaitGroup

	for w := 0; w < 10; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for asset := range jobs {
				processSingleAsset(ctx, db, asset)
			}
		}()
	}

	for _, asset := range assets {
		jobs <- asset
	}
	close(jobs)
	wg.Wait()
	recordPortfolioSnapshots(ctx, db)
	slog.Info("Canlı fiyat taraması tamamlandı", "gecen_sure", time.Since(startTime))
}

func processSingleAsset(ctx context.Context, db *database.Queries, asset database.Asset) {
	var newPrice float64
	var fetchErr error

	if asset.AssetType == "HISSE" || asset.AssetType == "ALTIN" || asset.AssetType == "DOVIZ" {
		newPrice, fetchErr = FetchBISTPrice(asset.Symbol)
	} else if asset.AssetType == "FON" {
		newPrice, fetchErr = FetchTEFASPrice(asset.Symbol)
	} else {
		return
	}

	if fetchErr != nil {
		slog.Error("Fiyat çekilemedi", "symbol", asset.Symbol, "error", fetchErr)
		return
	}

	priceStr := fmt.Sprintf("%.6f", newPrice)

	oldPrice, _ := strconv.ParseFloat(asset.CurrentPrice, 64)
	if math.Abs(newPrice-oldPrice) > 0.000001 {
		_, err := db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
			ID:           asset.ID,
			CurrentPrice: priceStr,
		})
		if err != nil {
			slog.Error("Fiyat veritabanında güncellenemedi", "symbol", asset.Symbol, "error", err)
			return
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

	checkAndTriggerAlerts(ctx, db, asset, newPrice, priceStr)
}

func checkAndTriggerAlerts(ctx context.Context, db *database.Queries, asset database.Asset, newPrice float64, priceStr string) {
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
}

var lastSnapshotDay int

func recordPortfolioSnapshots(ctx context.Context, db *database.Queries) {
	now := time.Now()
	if now.Hour() < 18 || lastSnapshotDay == now.Day() {
		return
	}
	userIDs, err := db.ListUserIDs(ctx)
	if err != nil {
		return
	}
	for _, userID := range userIDs {
		holdings, err := db.GetUserHoldingsSummary(ctx, userID)
		if err != nil || len(holdings) == 0 {
			continue
		}
		var totalValue float64
		var totalCost float64
		for _, h := range holdings {
			currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
			totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
			avgCost := parseAverageCost(h.AverageCost)
			totalValue += currentPrice * totalAmount
			totalCost += avgCost * totalAmount
		}
		pnl := totalValue - totalCost
		_, _ = db.CreatePortfolioSnapshot(ctx, database.CreatePortfolioSnapshotParams{
			UserID:     userID,
			TotalValue: fmt.Sprintf("%.6f", totalValue),
			TotalCost:  fmt.Sprintf("%.6f", totalCost),
			ProfitLoss: fmt.Sprintf("%.6f", pnl),
			RecordedAt: time.Now().UTC(),
		})
	}
	lastSnapshotDay = now.Day()
}

func parseAverageCost(val any) float64 {
	var avgCostStr string
	switch v := val.(type) {
	case string:
		avgCostStr = v
	case []byte:
		avgCostStr = string(v)
	default:
		avgCostStr = fmt.Sprintf("%v", v)
	}
	avgCost, _ := strconv.ParseFloat(avgCostStr, 64)
	return avgCost
}
