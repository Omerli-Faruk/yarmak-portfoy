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
)

// StartScraperWorker — Tüm arka plan görevlerini (TEFAS, BIST, Backfill, Portfolio Snapshot) asenkron olarak başlatan ana yöneticidir.
func StartScraperWorker(ctx context.Context, db *database.Queries, interval time.Duration, wg *sync.WaitGroup) {
	slog.Info("Yeni Mimari (v2) Scraper Yöneticisi Başlatılıyor...")
	
	// 1. TEFAS Günlük Güncelleyici (Akşam 20:00 ve Sabah 09:00)
	StartTefasDailyWorker(ctx, db, wg)
	
	// 2. BIST Gün İçi Canlı Fiyat Güncelleyici (Mesai saatleri içinde her 15 dakikada bir)
	StartBistIntradayWorker(ctx, db, wg)
	
	// 3. Arka Plan Geçmiş Veri (Backfill) İşleyicisi (Kuyruk tabanlı)
	StartBackfillWorker(ctx, db, wg)

	// Portfolio Snapshot Manager
	wg.Add(1)
	go func() {
		defer wg.Done()
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
	}()
}

// checkAndTriggerAlerts — Varlığın yeni fiyatı, kullanıcıların belirlediği fiyat alarmlarını geçiyorsa bu alarmları tetikler ve loglar.
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

var lastSnapshotDay atomic.Int32

// recordPortfolioSnapshots — Her akşam mesai bitiminden sonra kullanıcıların anlık portföy durumlarını hesaplayıp gün sonu snapshot olarak kaydeder.
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
			_, avgCost := CalculateAssetHoldingAndCost(userTxs)
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

// CalculateAssetHoldingAndCost — Varlığın tüm işlem listesini alarak WAC metoduna göre ortalama maliyetini ve eldeki mevcut lot sayısını hesaplar.
func CalculateAssetHoldingAndCost(transactions []database.Transaction) (currentLot float64, avgCost float64) {
	runningLot := 0.0
	runningCost := 0.0
	for _, tx := range transactions {
		amount, _ := strconv.ParseFloat(tx.Amount, 64)
		price, _ := strconv.ParseFloat(tx.Price, 64)
		commission, _ := strconv.ParseFloat(tx.Commission, 64)
		if tx.Type == "BUY" {
			total := (amount * price) + commission
			// Sıfıra bölme koruması: bozuk veri gelirse NaN yayılmasını engelle
			if (runningLot + amount) > 0 {
				runningCost = (runningLot*runningCost + total) / (runningLot + amount)
			}
			runningLot = runningLot + amount
		} else if tx.Type == "SELL" {
			runningLot = runningLot - amount
			if runningLot <= 0.000001 {
				runningLot = 0
				runningCost = 0
			}
		}
	}
	return runningLot, runningCost
}
