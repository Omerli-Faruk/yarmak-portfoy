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
// Her işçinin süresi kendi içinde: TEFAS saat hesabıyla, BIST 5 dk, backfill 2 sn, portföy özeti 1 saat.
func StartScraperWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
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
				runSafely("portföy özeti", func() { recordPortfolioSnapshots(ctx, db) })
			}
		}
	})
}

// checkAndTriggerAlerts, varlığın yeni fiyatı, kullanıcıların belirlediği fiyat alarmlarını geçiyorsa bu alarmları tetikler ve loglar.
func checkAndTriggerAlerts(ctx context.Context, db database.Querier, asset database.Asset, newPrice float64, priceStr string) {
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
				continue
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

// lastSnapshotDay, bugünün özetinin hatasız tamamlandığı gün. Yalnızca bellekte; yeniden başlatmada sıfırlanır,
// ama yazım upsert olduğu için (günde tek satır) tekrar yazmak yeni satır açmaz.
var lastSnapshotDay atomic.Int32

// recordPortfolioSnapshots, her akşam 18:00'den sonra kullanıcıların portföy değerini gün sonu özeti olarak yazar.
// Bir kullanıcıda hata olursa gün tamamlandı sayılmaz; saatlik tur bir sonraki saatte tekrar dener.
func recordPortfolioSnapshots(ctx context.Context, db *database.Queries) {
	loc, _ := time.LoadLocation("Europe/Istanbul") // tzdata imajda var
	now := time.Now().In(loc)
	if now.Hour() < 18 || lastSnapshotDay.Load() == int32(now.YearDay()) {
		return
	}
	userIDs, err := db.ListUserIDs(ctx)
	if err != nil {
		slog.Error("Portföy özeti: kullanıcılar okunamadı, bir saat sonra tekrar denenecek", "error", err)
		return
	}

	failed := 0
	for _, userID := range userIDs {
		if err := snapshotUser(ctx, db, userID); err != nil {
			failed++
			slog.Error("Portföy özeti yazılamadı", "user_id", userID, "error", err)
		}
	}

	if err := db.DeleteExpiredRefreshTokens(ctx); err != nil {
		slog.Warn("Süresi dolmuş oturumlar silinemedi", "error", err)
	}

	if failed > 0 {
		slog.Warn("Portföy özeti bazı kullanıcılarda yazılamadı, bir saat sonra tekrar denenecek",
			"failed", failed, "users", len(userIDs))
		return
	}
	lastSnapshotDay.Store(int32(now.YearDay()))
}

// snapshotUser, tek kullanıcının o günkü özetini yazar. Veriler okunamazsa yazmaz ve hata döner:
// maliyeti 0 olan yanlış bir satır kalıcı olurdu, hiç satır olmaması daha iyi.
func snapshotUser(ctx context.Context, db database.Querier, userID int64) error {
	holdings, err := db.GetUserHoldingsSummary(ctx, userID)
	if err != nil {
		return fmt.Errorf("varlıklar okunamadı: %w", err)
	}
	if len(holdings) == 0 {
		return nil // portföyü boş, yazacak bir şey yok
	}

	var totalValue, totalCost float64
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64) // NUMERIC NOT NULL, hata olamaz
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		userTxs, err := db.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
			UserID:  userID,
			AssetID: h.AssetID,
		})
		if err != nil {
			return fmt.Errorf("%s işlemleri okunamadı: %w", h.Symbol, err)
		}
		_, avgCost := wac.HoldingAndCost(userTxs)
		totalValue += currentPrice * totalAmount
		totalCost += avgCost * totalAmount
	}

	err = db.UpsertPortfolioSnapshot(ctx, database.UpsertPortfolioSnapshotParams{
		UserID:     userID,
		TotalValue: fmt.Sprintf("%.6f", totalValue),
		TotalCost:  fmt.Sprintf("%.6f", totalCost),
		ProfitLoss: fmt.Sprintf("%.6f", totalValue-totalCost),
		RecordedAt: time.Now().UTC(),
	})
	if err != nil {
		return fmt.Errorf("özet kaydedilemedi: %w", err)
	}
	return nil
}

// runSafely, bir işçi turunu panic'e karşı korur. recover olmayan bir goroutine'de panic bütün süreci
// (HTTP sunucusu ve diğer işçiler dahil) düşürür; burada yalnızca o tur kaybedilir ve loglanır.
func runSafely(name string, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("İşçi turunda panic yakalandı", "worker", name, "panic", r)
		}
	}()
	fn()
}
