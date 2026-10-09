package scraper

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
	"yarmak/internal/database"
)

func StartBackfillWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		slog.Info("Backfill kuyruk işleyicisi başlatıldı")
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("Backfill worker durduruldu")
				return
			case <-ticker.C:
				processNextBackfill(ctx, db)
			}
		}
	}()
}

func processNextBackfill(ctx context.Context, db *database.Queries) {
	// Kuyruktaki sıradaki işi al
	task, err := db.GetNextBackfillTask(ctx)
	if err != nil {
		return // Bekleyen iş yok ya da sorgu hata verdi
	}

	// İşi "işleniyor" olarak işaretle
	err = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
		ID:           task.ID,
		Status:       "PROCESSING",
		ErrorMessage: "",
	})
	if err != nil {
		return
	}

	asset, err := db.GetAssetByID(ctx, int64(task.AssetID))
	if err != nil {
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{ID: task.ID, Status: "FAILED", ErrorMessage: "Varlık bulunamadı"})
		return
	}

	slog.Info("Geçmiş veri doldurma başlatıldı", "symbol", asset.Symbol, "type", asset.AssetType)

	var processErr error
	if asset.AssetType == "FON" {
		processErr = backfillTEFAS(ctx, db, asset)
	} else {
		processErr = backfillBIST(ctx, db, asset)
	}

	if processErr != nil {
		slog.Error("Backfill başarısız", "symbol", asset.Symbol, "error", processErr)
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
			ID:           task.ID,
			Status:       "FAILED",
			ErrorMessage: processErr.Error(),
		})
	} else {
		slog.Info("Backfill tamamlandı", "symbol", asset.Symbol)
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
			ID:           task.ID,
			Status:       "COMPLETED",
			ErrorMessage: "",
		})
	}
}

func backfillBIST(ctx context.Context, db *database.Queries, asset database.Asset) error {
	// Yahoo 5 yıllık veriyi tek istekte veriyor
	currentPrice, history, err := FetchBISTHistory(asset.Symbol, "5y")
	if err != nil {
		return err
	}

	// Güncel fiyatı da yaz
	_, _ = db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
		ID:           asset.ID,
		CurrentPrice: fmt.Sprintf("%.6f", currentPrice),
	})

	for _, h := range history {
		_ = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
			AssetID:    asset.ID,
			Price:      fmt.Sprintf("%.6f", h.Price),
			RecordedAt: h.Date.UTC(),
		})
	}
	return nil
}

func backfillTEFAS(ctx context.Context, db *database.Queries, asset database.Asset) error {
	today := time.Now()
	oneMonthAgo := today.AddDate(0, -1, 0)

	// Kalan 5 yılı 3 aylık parçalar halinde, aralarda bekleyerek çek
	slog.Info("TEFAS backfill (kalan 5 yıl, yavaş çekim)", "symbol", asset.Symbol)

	fiveYearsAgo := today.AddDate(-5, 0, 0)
	currentEnd := oneMonthAgo.AddDate(0, 0, -1) // Son bir ayı QuickSyncAsset çektiği için ondan öncesine kadar gidiyoruz

	failedChunks := 0
	currentChunkStart := fiveYearsAgo
	for currentChunkStart.Before(currentEnd) {
		chunkEnd := currentChunkStart.AddDate(0, 3, 0)
		if chunkEnd.After(currentEnd) {
			chunkEnd = currentEnd
		}

		// Parça kısmen alınamasa bile gelen veriyi kaydediyoruz; eksik parçaları sonda hata olarak bildiriyoruz.
		hist, err := FetchTEFASFundHistory(asset.Symbol, currentChunkStart, chunkEnd)
		if err != nil {
			failedChunks++
			slog.Warn("TEFAS backfill parçası tam alınamadı, gelen veri kaydediliyor", "symbol", asset.Symbol, "error", err)
		}
		for _, h := range hist {
			_ = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
				AssetID:    asset.ID,
				Price:      fmt.Sprintf("%.6f", h.Price),
				RecordedAt: h.Date.UTC(),
			})
		}

		currentChunkStart = chunkEnd.AddDate(0, 0, 1)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(12 * time.Second):
		}
	}

	if failedChunks > 0 {
		return fmt.Errorf("TEFAS geçmişinin %d parçası tam alınamadı", failedChunks)
	}
	return nil
}

func QuickSyncAsset(ctx context.Context, db *database.Queries, asset database.Asset) error {
	if asset.AssetType != "FON" {
		return backfillBIST(ctx, db, asset)
	}

	today := time.Now()
	oneMonthAgo := today.AddDate(0, -1, 0)
	// Hata gelse de alınabilen günleri önce kaydediyor, hatayı sonra dönüyoruz.
	recentHistory, err := FetchTEFASFundHistory(asset.Symbol, oneMonthAgo, today)
	for _, h := range recentHistory {
		_ = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
			AssetID:    asset.ID,
			Price:      fmt.Sprintf("%.6f", h.Price),
			RecordedAt: h.Date.UTC(),
		})
	}
	if len(recentHistory) > 0 {
		_, _ = db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
			ID:           asset.ID,
			CurrentPrice: fmt.Sprintf("%.6f", recentHistory[len(recentHistory)-1].Price),
		})
	}
	return err
}
