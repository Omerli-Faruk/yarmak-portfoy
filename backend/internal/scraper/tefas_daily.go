package scraper

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
	"yarmak/internal/database"
)

func StartTefasDailyWorker(ctx context.Context, db *database.Queries, wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		slog.Info("TEFAS Daily worker başlatıldı")
		
		// Sunucu ilk açıldığında hemen bir kez güncel verileri çek
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("TEFAS İlk açılış döngüsünde panic yakalandı", "panic", r)
				}
			}()
			runTefasDailyCycle(ctx, db)
		}()
		
		for {
			now := time.Now()
			// Hedef: Her akşam 20:00 ve sabah 09:00 (TEFAS fiyatları 18:30 ile sabah arası güncellenir)
			var next time.Time
			if now.Hour() < 9 {
				next = time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, now.Location())
			} else if now.Hour() < 20 {
				next = time.Date(now.Year(), now.Month(), now.Day(), 20, 0, 0, 0, now.Location())
			} else {
				next = time.Date(now.Year(), now.Month(), now.Day()+1, 9, 0, 0, 0, now.Location())
			}
			
			waitDuration := next.Sub(now)
			slog.Info(fmt.Sprintf("Bir sonraki TEFAS Daily işlemi %v sonra başlayacak", waitDuration))

			select {
			case <-ctx.Done():
				slog.Info("TEFAS Daily worker durduruldu")
				return
			case <-time.After(waitDuration):
			}

			func() {
				defer func() {
					if r := recover(); r != nil {
						slog.Error("TEFAS Daily döngüsünde panic yakalandı", "panic", r)
					}
				}()
				runTefasDailyCycle(ctx, db)
			}()
		}
	}()
}

func runTefasDailyCycle(ctx context.Context, db *database.Queries) {
	slog.Info("TEFAS Toplu Fiyat Çekimi Başladı...")
	
	// Fetch all funds for the latest trading day (once!)
	fundTypes := []string{"YAT", "EMK"} // Yatırım Fonları ve Emeklilik Fonları
	var allFunds []TEFASFundData
	
	for _, fType := range fundTypes {
		funds, err := FetchAllTEFASFunds(time.Time{}, fType)
		if err != nil {
			slog.Error("TEFAS toplu fon çekimi hatası", "tip", fType, "error", err)
			continue
		}
		allFunds = append(allFunds, funds...)
	}

	if len(allFunds) == 0 {
		slog.Warn("TEFAS'tan hiçbir fon verisi dönmedi.")
		return
	}

	// Sadece aktif varlıkları güncelle
	activeAssets, err := db.GetActiveAssets(ctx)
	if err != nil {
		slog.Error("Aktif varlıklar çekilemedi", "error", err)
		return
	}
	activeMap := make(map[string]database.Asset)
	for _, a := range activeAssets {
		if a.AssetType == "FON" {
			activeMap[a.Symbol] = a
		}
	}

	updateCount := 0
	for _, fund := range allFunds {
		if asset, ok := activeMap[fund.Symbol]; ok {
			priceStr := fmt.Sprintf("%.6f", fund.Price)
			
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
				RecordedAt: fund.Date.UTC(), // DO UPDATE takes care of overwriting if corrected
			})
			if err == nil {
				updateCount++
			}
		}
	}
	slog.Info("TEFAS Toplu Fiyat Çekimi Tamamlandı", "guncellenen_fon_sayisi", updateCount)
}
