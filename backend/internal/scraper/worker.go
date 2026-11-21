package scraper

import (
	"context"
	"log/slog"
	"strconv"
	"sync"
	"time"
	"yarmak/internal/database"
)

// StartScraperWorker, tüm arka plan görevlerini (TEFAS, BIST, backfill, oturum temizliği) asenkron olarak başlatan ana yöneticidir.
// Her işçinin süresi kendi içinde: TEFAS saat hesabıyla, BIST 5 dk, backfill 2 sn, oturum temizliği 1 saat.
func StartScraperWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	slog.Info("Yeni Mimari (v2) Scraper Yöneticisi Başlatılıyor...")

	// 1. TEFAS günlük fiyatları: sabah 09:00, akşam 18:15 ve 18:00-21:00 arasında yarım saatte bir
	StartTefasDailyWorker(ctx, db, wg)

	// 2. BIST, altın ve döviz fiyatları: iş günlerinde 10:00-18:15 arasında 5 dakikada bir
	StartBistIntradayWorker(ctx, db, wg)

	// 3. Arka Plan Geçmiş Veri (Backfill) İşleyicisi (Kuyruk tabanlı)
	StartBackfillWorker(ctx, db, wg)

	// 4. Süresi dolmuş oturumları (refresh token) temizle: saatte bir
	wg.Go(func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runSafely("oturum temizliği", func() {
					if err := db.DeleteExpiredRefreshTokens(ctx); err != nil && !stopping(ctx) {
						slog.Warn("Süresi dolmuş oturumlar silinemedi", "error", err)
					}
				})
			}
		}
	})
}

// checkAndTriggerAlerts, varlığın yeni fiyatı, kullanıcıların belirlediği fiyat alarmlarını geçiyorsa bu alarmları tetikler ve loglar.
func checkAndTriggerAlerts(ctx context.Context, db database.Querier, asset database.Asset, newPrice float64, priceStr string) {
	alerts, err := db.GetPendingAlertsForAsset(ctx, asset.ID)
	if err != nil && !stopping(ctx) {
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

// stopping: sunucu kapanırken işçilerin context'i iptal edilir; o andaki veritabanı ve ağ hataları ("context canceled",
// "canceling statement") gerçek hata değildir, loglanmaz. Eskiden her kapanışta ERROR satırları çıkıyordu (#59).
func stopping(ctx context.Context) bool {
	return ctx.Err() != nil
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
