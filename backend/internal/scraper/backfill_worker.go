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
		slog.Info("Backfill Queue worker başlatıldı")
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
	// Skip if a backfill task is already running in this goroutine
	task, err := db.GetNextBackfillTask(ctx)
	if err != nil {
		return // No tasks or error
	}

	// Mark as processing
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
		db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{ID: task.ID, Status: "FAILED", ErrorMessage: "Asset bulunamadı"})
		return
	}

	slog.Info("Geçmiş veri doldurma (Backfill) başlatıldı", "symbol", asset.Symbol, "type", asset.AssetType)

	var processErr error
	if asset.AssetType == "FON" {
		processErr = backfillTEFAS(ctx, db, asset)
	} else {
		processErr = backfillBIST(ctx, db, asset)
	}

	if processErr != nil {
		slog.Error("Backfill başarısız", "symbol", asset.Symbol, "error", processErr)
		db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
			ID:           task.ID,
			Status:       "FAILED",
			ErrorMessage: processErr.Error(),
		})
	} else {
		slog.Info("Backfill tamamlandı", "symbol", asset.Symbol)
		db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
			ID:           task.ID,
			Status:       "COMPLETED",
			ErrorMessage: "",
		})
	}
}

func backfillBIST(ctx context.Context, db *database.Queries, asset database.Asset) error {
	// Yahoo Finance can fetch 5 years in a single fast call
	currentPrice, history, err := FetchBISTHistory(asset.Symbol, "5y")
	if err != nil {
		return err
	}

	// Update current price
	db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
		ID:           asset.ID,
		CurrentPrice: fmt.Sprintf("%.6f", currentPrice),
	})

	for _, h := range history {
		db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
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

	// Geriye kalan 5 yılı yavaşça (chunks halinde) çek
	slog.Info("TEFAS Backfill Queue (Kalan 5 Yıl, Yavaş Çekim)", "symbol", asset.Symbol)
	
	fiveYearsAgo := today.AddDate(-5, 0, 0)
	currentEnd := oneMonthAgo.AddDate(0, 0, -1) // 1 ay öncesinden geriye git
	
	currentChunkStart := fiveYearsAgo
	for currentChunkStart.Before(currentEnd) {
		chunkEnd := currentChunkStart.AddDate(0, 3, 0)
		if chunkEnd.After(currentEnd) {
			chunkEnd = currentEnd
		}
		
		hist, err := FetchTEFASFundHistory(asset.Symbol, currentChunkStart, chunkEnd)
		if err != nil {
			slog.Warn("TEFAS Backfill chunk çekiminde hata, atlanıyor...", "symbol", asset.Symbol, "error", err)
		} else {
			for _, h := range hist {
				db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
					AssetID:    asset.ID,
					Price:      fmt.Sprintf("%.6f", h.Price),
					RecordedAt: h.Date.UTC(),
				})
			}
		}
		
		currentChunkStart = chunkEnd.AddDate(0, 0, 1)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(12 * time.Second):
		}
	}

	return nil
}

func QuickSyncAsset(ctx context.Context, db *database.Queries, asset database.Asset) error {
    if asset.AssetType == "FON" {
        today := time.Now()
        oneMonthAgo := today.AddDate(0, -1, 0)
        recentHistory, err := FetchTEFASFundHistory(asset.Symbol, oneMonthAgo, today)
        if err != nil { return err }
        for _, h := range recentHistory {
            db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
                AssetID: asset.ID,
                Price: fmt.Sprintf("%%.6f", h.Price),
                RecordedAt: h.Date.UTC(),
            })
        }
        if len(recentHistory) > 0 {
            db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
                ID: asset.ID,
                CurrentPrice: fmt.Sprintf("%%.6f", recentHistory[len(recentHistory)-1].Price),
            })
        }
        return nil
    } else {
        return backfillBIST(ctx, db, asset)
    }
}
