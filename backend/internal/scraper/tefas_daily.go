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

	// Sadece aktif (portföyde veya izleme listesinde olan) varlıkları bul (history için)
	activeAssets, err := db.GetActiveAssets(ctx)
	if err != nil {
		slog.Error("Aktif varlıklar çekilemedi", "error", err)
		return
	}
	activeMap := make(map[string]bool)
	for _, a := range activeAssets {
		if a.AssetType == "FON" {
			activeMap[a.Symbol] = true
		}
	}

	updateCount := 0
	for _, fund := range allFunds {
		priceStr := fmt.Sprintf("%.6f", fund.Price)
		
		// 1. Her zaman fonu Upsert et (Böylece yeni fonlar sisteme girer, mevcutların live fiyatı güncellenir)
		asset, err := db.UpsertAsset(ctx, database.UpsertAssetParams{
			Symbol:       fund.Symbol,
			Name:         fund.Name,
			AssetType:    "FON",
			CurrentPrice: priceStr,
		})
		
		if err != nil {
			continue // Veritabanı hatası
		}

		// 2. Eğer bu fon aktif bir fon ise, Price History tablosuna kaydet
		if activeMap[fund.Symbol] {
			err = db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
				AssetID:    asset.ID,
				Price:      priceStr,
				RecordedAt: fund.Date.UTC(),
			})
			if err == nil {
				updateCount++
			}
		}
	}
	slog.Info("TEFAS Toplu Fiyat Çekimi Tamamlandı", "guncellenen_aktif_fon_sayisi", updateCount)
}
