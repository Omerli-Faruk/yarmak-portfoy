package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"yarmak/internal/database"

	_ "github.com/lib/pq"
)

type tefasResponse struct {
	ResultList []struct {
		Tarih   string  `json:"tarih"`
		FonKodu string  `json:"fonKodu"`
		Fiyat   float64 `json:"fiyat"`
	} `json:"resultList"`
}

func main() {
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@db:5432/yarmak?sslmode=disable"
	}
	dbConn, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("DB bağlantı hatası: %v", err)
	}
	defer dbConn.Close()
	db := database.New(dbConn)
	ctx := context.Background()

	log.Println("TEFAS fon fiyat geçmişi indiriliyor")

	today := time.Now()
	// Varsayılan: 5 yıl öncesi (İlk kurulum için)
	currentStart := today.AddDate(-5, 0, 0)

	// Veritabanındaki mevcut fon fiyat geçmişini kontrol et
	var maxRecordedAt sql.NullTime
	var countRecords int64
	err = dbConn.QueryRowContext(ctx, `
		SELECT MAX(ph.recorded_at), COUNT(ph.id) 
		FROM price_history ph 
		JOIN assets a ON ph.asset_id = a.id 
		WHERE a.asset_type = 'FON' AND ph.recorded_at > '2000-01-01'
	`).Scan(&maxRecordedAt, &countRecords)

	forceFull := os.Getenv("FORCE_FULL_BACKFILL") == "true"

	if err == nil && countRecords > 1000 && maxRecordedAt.Valid && !forceFull {
		log.Printf("Veritabanında %d fon fiyat kaydı var (son kayıt: %s)",
			countRecords, maxRecordedAt.Time.Format("2006-01-02"))

		oneMonthAgo := today.AddDate(0, -1, 0)
		// Eğer son kayıt 1 aydan daha eskiyse, aradaki boşluğu kapatmak için son kayıt tarihinden başla
		if maxRecordedAt.Time.Before(oneMonthAgo) && maxRecordedAt.Time.After(today.AddDate(-5, 0, 0)) {
			currentStart = maxRecordedAt.Time.AddDate(0, 0, -3) // 3 gün güvenlik payı
			log.Printf("Son kayıt eski, %s tarihinden itibaren eksikler indiriliyor",
				currentStart.Format("2006-01-02"))
		} else {
			// Son kayıt güncel (son 1 ay içinde): Sadece son 1 ayı güncelle ("son ay çeksin yeter")
			currentStart = oneMonthAgo
			log.Printf("Geçmiş zaten var, yalnızca son bir ay güncelleniyor (%s -> %s)",
				currentStart.Format("2006-01-02"), today.Format("2006-01-02"))
		}
	} else {
		log.Println("İlk kurulum: tüm fonların (3200+) son 5 yıllık geçmişi ay ay indirilecek, 20-30 dakika sürebilir")
	}

	// Create a map of Symbol -> AssetID for quick lookups
	assets, err := db.ListAssets(ctx)
	if err != nil {
		log.Fatalf("Varlıklar çekilemedi: %v", err)
	}
	assetMap := make(map[string]int64)
	for _, a := range assets {
		if a.AssetType == "FON" {
			assetMap[a.Symbol] = int64(a.ID)
		}
	}

	for currentStart.Before(today) {
		currentEnd := currentStart.AddDate(0, 1, 0) // 1 aylık bloklar (TEFAS çok veri döndürdüğü için patlamasın)
		if currentEnd.After(today) {
			currentEnd = today
		}

		log.Printf(">>> Tüm Piyasa Çekiliyor: %s -> %s", currentStart.Format("2006-01-02"), currentEnd.Format("2006-01-02"))

		reqBody := map[string]interface{}{
			"fonTipi":  "YAT",
			"fonKodu":  "",
			"basTarih": currentStart.Format("20060102"),
			"bitTarih": currentEnd.Format("20060102"),
			"basSira":  1,
			"bitSira":  100000,
			"dil":      "TR",
		}
		jsonBytes, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", bytes.NewBuffer(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Mozilla/5.0")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("    ! Ağ Hatası. 15 DAKİKA zorunlu dinlenme... (%v)", err)
			time.Sleep(15 * time.Minute)
			continue // aynı bloğu tekrar dener
		}

		if resp.StatusCode == 429 {
			log.Printf("    ! 429 Throttling Yedik! TEFAS IP Ban. 15 DAKİKA zorunlu dinlenme...")
			resp.Body.Close()
			time.Sleep(15 * time.Minute)
			continue
		}

		if resp.StatusCode == 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			var tefasRes tefasResponse
			if err := json.Unmarshal(bodyBytes, &tefasRes); err == nil {
				inserted := 0
				for _, rec := range tefasRes.ResultList {
					assetID, exists := assetMap[rec.FonKodu]
					if !exists {
						continue // We don't care about funds not in our DB
					}

					var parsedDate time.Time
					if pt, err := time.Parse("2006-01-02", rec.Tarih); err == nil {
						parsedDate = pt
					} else {
						continue
					}

					err := db.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
						AssetID:    assetID,
						Price:      fmt.Sprintf("%.6f", rec.Fiyat),
						RecordedAt: parsedDate.UTC(),
					})
					if err == nil {
						inserted++
					}
				}
				log.Printf("    - Başarılı! %d fiyat kaydı eklendi. 15 saniye dinleniliyor...", inserted)
			} else {
				log.Printf("    ! JSON parse hatası: %v", err)
			}
		} else {
			resp.Body.Close()
			log.Printf("    ! Beklenmeyen HTTP Kodu: %d. 1 DAKİKA dinleniliyor...", resp.StatusCode)
			time.Sleep(time.Minute)
			continue
		}

		currentStart = currentEnd.AddDate(0, 0, 1)
		time.Sleep(15 * time.Second)
	}

	log.Println("Fon fiyat geçmişi güncellendi")
}
