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
	dbURL := "postgres://postgres:postgres@db:5432/yarmak?sslmode=disable"
	dbConn, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("DB bağlantı hatası: %v", err)
	}
	db := database.New(dbConn)
	ctx := context.Background()

	log.Println("TEFAS Ultra-Hızlı Derin Tarayıcı (Toplu Tarama) Başlatılıyor...")
	log.Println("Tüm pazar (3200+ fon) ay-ay tek seferde çekilecek.")
	log.Println("Bu işlem eskisi gibi 3 gün değil, sadece ~20-30 dakika sürecek!")

	today := time.Now()
	// Start from 5 years ago
	currentStart := today.AddDate(-5, 0, 0)
	
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
	
	log.Println("TÜM FONLARIN 5 YILLIK VERİSİ BAŞARIYLA İNDİRİLDİ!")
}
