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
		slog.Info("Backfill Queue worker baÅŸlatÄ±ldÄ±")
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
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{ID: task.ID, Status: "FAILED", ErrorMessage: "Asset bulunamadÄ±"})
		return
	}

	slog.Info("GeÃ§miÅŸ veri doldurma (Backfill) baÅŸlatÄ±ldÄ±", "symbol", asset.Symbol, "type", asset.AssetType)

	var processErr error
	if asset.AssetType == "FON" {
		processErr = backfillTEFAS(ctx, db, asset)
	} else {
		processErr = backfillBIST(ctx, db, asset)
	}

	if processErr != nil {
		slog.Error("Backfill baÅŸarÄ±sÄ±z", "symbol", asset.Symbol, "error", processErr)
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
			ID:           task.ID,
			Status:       "FAILED",
			ErrorMessage: processErr.Error(),
		})
	} else {
		slog.Info("Backfill tamamlandÄ±", "symbol", asset.Symbol)
		_ = db.UpdateBackfillTaskStatus(ctx, database.UpdateBackfillTaskStatusParams{
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

	// Geriye kalan 5 yÄ±lÄ± yavaÅŸÃ§a (chunks halinde) Ã§ek
	slog.Info("TEFAS Backfill Queue (Kalan 5 YÄ±l, YavaÅŸ Ã‡ekim)", "symbol", asset.Symbol)
	
	fiveYearsAgo := today.AddDate(-5, 0, 0)
	currentEnd := oneMonthAgo.AddDate(0, 0, -1) // 1 ay Ã¶ncesinden geriye git
	
	currentChunkStart := fiveYearsAgo
	for currentChunkStart.Before(currentEnd) {
		chunkEnd := currentChunkStart.AddDate(0, 3, 0)
		if chunkEnd.After(currentEnd) {
			chunkEnd = currentEnd
		}
		
		hist, err := FetchTEFASFundHistory(asset.Symbol, currentChunkStart, chunkEnd)
		if err != nil {
			slog.Warn("TEFAS Backfill chunk Ã§ekiminde hata, atlanÄ±yor...", "symbol", asset.Symbol, "error", err)
		} else {
			for _, h := range hist {
				_ = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
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
            if h.Price <= 0 {
                continue
            }
            _ = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
                AssetID: asset.ID,
                Price: fmt.Sprintf("%.6f", h.Price),
                RecordedAt: h.Date.UTC(),
            })
        }
        // En güncel geçerli pozitif fiyatı bul ve asset'in current_price'ını güncelle
        for i := len(recentHistory) - 1; i >= 0; i-- {
            if recentHistory[i].Price > 0 {
                _, _ = db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
                    ID: asset.ID,
                    CurrentPrice: fmt.Sprintf("%.6f", recentHistory[i].Price),
                })
                break
            }
        }
        return nil
    } else {
        return backfillBIST(ctx, db, asset)
    }
}
