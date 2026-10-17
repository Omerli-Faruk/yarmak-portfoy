package scraper

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/wac"
)

// StartScraperWorker, tüm arka plan görevlerini (TEFAS, BIST, Backfill, Portfolio Snapshot) asenkron olarak başlatan ana yöneticidir.
func StartScraperWorker(ctx context.Context, db *database.Queries, interval time.Duration, wg *sync.WaitGroup) {
	slog.Info("Yeni Mimari (v2) Scraper Yöneticisi Başlatılıyor...")

	// 1. TEFAS günlük fiyatları: sabah 09:00, akşam 18:15 ve 18:00-21:00 arasında yarım saatte bir
	StartTefasDailyWorker(ctx, db, wg)

	// 2. BIST, altın ve döviz fiyatları: iş günlerinde 10:00-18:15 arasında 5 dakikada bir
	StartBistIntradayWorker(ctx, db, wg)

	// 3. Arka Plan Geçmiş Veri (Backfill) İşleyicisi (Kuyruk tabanlı)
	StartBackfillWorker(ctx, db, wg)

	// 4. Günlük portföy özeti: saatte bir bakılır, 18:00'den sonra günde bir kez yazılır
	wg.Go(func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				recordPortfolioSnapshots(ctx, db)
			}
		}
	})
}

// checkAndTriggerAlerts, varlığın yeni fiyatı, kullanıcıların belirlediği fiyat alarmlarını geçiyorsa bu alarmları tetikler ve loglar.
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
			slog.Warn("Fiyat alarmı tetiklendi",
				"symbol", asset.Symbol,
				"direction", alert.Direction,
				"target_price", alert.TargetPrice,
				"current_price", priceStr,
				"user_id", alert.UserID,
			)
		}
	}
}

var lastSnapshotDay atomic.Int32

// recordPortfolioSnapshots, her akşam mesai bitiminden sonra kullanıcıların anlık portföy durumlarını hesaplayıp gün sonu snapshot olarak kaydeder.
func recordPortfolioSnapshots(ctx context.Context, db *database.Queries) {
	loc, _ := time.LoadLocation("Europe/Istanbul")
	now := time.Now().In(loc)
	if now.Hour() < 18 || lastSnapshotDay.Load() == int32(now.YearDay()) {
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
			userTxs, _ := db.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
				UserID:  userID,
				AssetID: h.AssetID,
			})
			_, avgCost := wac.HoldingAndCost(userTxs)
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
	_ = db.DeleteExpiredRefreshTokens(ctx)
	lastSnapshotDay.Store(int32(now.YearDay()))
}
