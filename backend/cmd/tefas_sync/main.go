package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"yarmak/internal/database"
	"yarmak/internal/scraper"

	_ "github.com/lib/pq"
)

func main() {
	mode := flag.String("mode", "catalog", "Mod: 'catalog' (tüm hisse ve fonları kaydet) veya 'history' (5 yıllık verileri indir)")
	targetType := flag.String("type", "all", "İşlenecek varlık türü: 'all' (hepsi), 'stocks' (sadece hisseler), 'funds' (sadece fonlar)")
	years := flag.Int("years", 5, "History modu için geriye dönük kaç yıl veri indirilecek")
	force := flag.Bool("force", false, "Daha önce indirilmiş verileri tekrar indirmeyi zorla")
	dbURL := flag.String("db", "postgres://postgres:postgres@localhost:5432/yarmak?sslmode=disable", "Veritabanı URL'si")
	flag.Parse()

	conn, err := sql.Open("postgres", *dbURL)
	if err != nil {
		slog.Error("Veritabanına bağlanılamadı", "error", err)
		os.Exit(1)
	}
	defer conn.Close()

	db := database.New(conn)
	ctx := context.Background()

	if *mode == "catalog" {
		runCatalogSync(ctx, db)
	} else if *mode == "history" {
		runHistorySync(ctx, conn, db, *years, *targetType, *force)
	} else {
		slog.Error("Geçersiz mod", "mode", *mode)
	}
}

type bistStockItem struct {
	Kod string `json:"kod"`
	Ad  string `json:"ad"`
	Tip string `json:"tip"`
}

func fetchAllBISTStocks() ([]bistStockItem, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", "https://bigpara.hurriyet.com.tr/api/v1/hisse/list", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Data []bistStockItem `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data.Data, nil
}

func runCatalogSync(ctx context.Context, db *database.Queries) {
	slog.Info("=== 1. BORSA İSTANBUL (BIST) HİSSELERİ AKTARILIYOR ===")
	bistStocks, err := fetchAllBISTStocks()
	if err != nil {
		slog.Error("BIST hisseleri çekilemedi", "error", err)
	} else {
		count := 0
		for _, stock := range bistStocks {
			sym := strings.ToUpper(strings.TrimSpace(stock.Kod))
			name := strings.TrimSpace(stock.Ad)
			if sym == "" {
				continue
			}
			_, err := db.UpsertAsset(ctx, database.UpsertAssetParams{
				Symbol:       sym,
				Name:         name,
				AssetType:    "HISSE",
				CurrentPrice: "0.0000",
			})
			if err != nil {
				slog.Error("Hisse kaydedilemedi", "symbol", sym, "error", err)
			} else {
				count++
			}
		}
		slog.Info("BIST hisseleri başarıyla yüklendi", "eklenen_veya_guncellenen", count)
	}

	slog.Info("=== 2. MAKRO VARLIKLAR (DÖVİZ, ALTIN, ENDEKSLER) EKLENİYOR ===")
	macros := []struct {
		sym, name, aType string
	}{
		{"USDTRY", "Amerikan Doları", "DOVIZ"},
		{"EURTRY", "Euro", "DOVIZ"},
		{"XU100", "BIST 100 Endeksi", "ENDEKS"},
		{"XU030", "BIST 30 Endeksi", "ENDEKS"},
		{"ALTIN", "Gram Altın", "ALTIN"},
	}
	for _, m := range macros {
		_, _ = db.UpsertAsset(ctx, database.UpsertAssetParams{
			Symbol:       m.sym,
			Name:         m.name,
			AssetType:    m.aType,
			CurrentPrice: "0.0000",
		})
	}

	slog.Info("=== 3. TEFAS FONLARI AKTARILIYOR (Kategoriler: YAT, EMK, BYF, GYF, GSYF) ===")
	totalFunds := 0
	fundTypes := []string{"YAT", "EMK", "BYF", "GYF", "GSYF"}
	for _, fType := range fundTypes {
		slog.Info(fmt.Sprintf("TEFAS %s fonları çekiliyor...", fType))
		funds, err := scraper.FetchAllTEFASFunds(time.Time{}, fType)
		if err != nil {
			slog.Error("TEFAS fonları çekilirken hata oluştu", "type", fType, "error", err)
			time.Sleep(6 * time.Second)
			continue
		}

		for _, fund := range funds {
			priceStr := fmt.Sprintf("%.6f", fund.Price)
			_, err := db.UpsertAsset(ctx, database.UpsertAssetParams{
				Symbol:       fund.Symbol,
				Name:         fund.Name,
				AssetType:    "FON",
				CurrentPrice: priceStr,
			})
			if err != nil {
				slog.Error("Fon veritabanına eklenemedi", "symbol", fund.Symbol, "error", err)
			} else {
				totalFunds++
			}
		}
		slog.Info(fmt.Sprintf("TEFAS %s fonları kaydedildi", fType), "adet", len(funds))
		time.Sleep(6 * time.Second) // WAF rate limit koruması
	}

	slog.Info("TÜM KATALOG SENKRONİZASYONU TAMAMLANDI!", "toplam_bist", len(bistStocks), "toplam_fon", totalFunds)
}

func getHistoryCounts(ctx context.Context, conn *sql.DB) (map[int64]int, error) {
	counts := make(map[int64]int)
	rows, err := conn.QueryContext(ctx, "SELECT asset_id, count(*) FROM price_history GROUP BY asset_id")
	if err != nil {
		return counts, err
	}
	defer rows.Close()

	for rows.Next() {
		var assetID int64
		var count int
		if err := rows.Scan(&assetID, &count); err == nil {
			counts[assetID] = count
		}
	}
	return counts, nil
}

func runHistorySync(ctx context.Context, conn *sql.DB, db *database.Queries, years int, targetType string, force bool) {
	assets, err := db.ListAssets(ctx)
	if err != nil {
		slog.Error("Varlıklar çekilemedi", "error", err)
		return
	}

	historyCounts, err := getHistoryCounts(ctx, conn)
	if err != nil {
		slog.Warn("Geçmiş kayıt sayıları sorgulanamadı", "error", err)
	}

	// 1. BIST Hisseleri Fiyat Geçmişi (Yahoo Finance üzerinden 5 yıllık günlük veriler)
	if targetType == "all" || targetType == "stocks" {
		slog.Info("=== BORSA İSTANBUL (BIST) HİSSELERİNİN 5 YILLIK GEÇMİŞİ VE CANLI FİYATLARI İNDİRİLİYOR ===")
		var stocks []database.Asset
		for _, a := range assets {
			if a.AssetType == "HISSE" {
				stocks = append(stocks, a)
			}
		}

		slog.Info("Toplam taranacak hisse sayısı:", "adet", len(stocks))
		rangeStr := fmt.Sprintf("%dy", years)

		skippedCount := 0
		processedCount := 0

		for i, stock := range stocks {
			existingCount := historyCounts[stock.ID]
			// Eğer daha önce veritabanına geçmiş kaydedilmişse ve --force verilmemişse atla
			if !force && existingCount > 0 {
				skippedCount++
				continue
			}

			curPrice, history, err := scraper.FetchBISTHistory(stock.Symbol, rangeStr)
			if err != nil {
				slog.Warn("Hisse geçmişi çekilemedi", "symbol", stock.Symbol, "error", err)
				continue
			}

			// Canlı / Son Kapanış Fiyatını assets tablosunda güncelle
			if curPrice > 0 {
				priceStr := fmt.Sprintf("%.4f", curPrice)
				_, _ = db.UpdateAssetPrice(ctx, database.UpdateAssetPriceParams{
					ID:           stock.ID,
					CurrentPrice: priceStr,
				})
			}

			// Geçmiş gün kapanış fiyatlarını price_history tablosuna mükerrersiz yaz
			savedCount := 0
			for _, rec := range history {
				priceStr := fmt.Sprintf("%.4f", rec.Price)
				err = db.InsertPriceHistoryIgnore(ctx, database.InsertPriceHistoryIgnoreParams{
					AssetID:    stock.ID,
					Price:      priceStr,
					RecordedAt: rec.Date,
				})
				if err == nil {
					savedCount++
				}
			}

			processedCount++
			slog.Info("Hisse fiyat geçmişi kaydedildi",
				"symbol", stock.Symbol,
				"ilerleme", fmt.Sprintf("%d/%d", i+1, len(stocks)),
				"güncel_fiyat", curPrice,
				"toplam_gun", len(history),
				"atlananlar", skippedCount,
			)

			time.Sleep(150 * time.Millisecond) // Sunucu yükünü dengede tut
		}
		slog.Info("BIST hisselerinin fiyat geçmişleri başarıyla senkronize edildi!",
			"yeni_islenen", processedCount,
			"onceden_kayitli_atlanan", skippedCount,
		)
	}

	// 2. TEFAS Fonları Fiyat Geçmişi (TEFAS API üzerinden)
	if targetType == "all" || targetType == "funds" {
		slog.Info("=== TEFAS FONLARININ 5 YILLIK GEÇMİŞİ İNDİRİLİYOR ===")
		endDate := time.Now()
		startDate := endDate.AddDate(-years, 0, 0)

		var funds []database.Asset
		for _, a := range assets {
			if a.AssetType == "FON" {
				funds = append(funds, a)
			}
		}

		slog.Info("Toplam taranacak fon sayısı:", "adet", len(funds))

		skippedFunds := 0
		processedFunds := 0

		for i, fund := range funds {
			existingCount := historyCounts[fund.ID]
			// Eğer daha önce veritabanına geçmiş kaydedilmişse ve --force verilmemişse atla
			if !force && existingCount > 0 {
				skippedFunds++
				if skippedFunds%50 == 0 || i == len(funds)-1 {
					slog.Info("Mevcut fonlar kontrol ediliyor...", "taranan", i+1, "toplam", len(funds), "onceden_kayitli", skippedFunds)
				}
				continue
			}

			slog.Info("🔍 Fon geçmişi indiriliyor...",
				"fon", fund.Symbol,
				"ad", fund.Name,
				"ilerleme", fmt.Sprintf("%d/%d", i+1, len(funds)),
			)

			history, err := scraper.FetchTEFASFundHistory(fund.Symbol, startDate, endDate)
			if err != nil {
				slog.Error("Fon geçmişi çekilemedi", "fon", fund.Symbol, "error", err)
				continue
			}

			for _, record := range history {
				priceStr := fmt.Sprintf("%.6f", record.Price)
				_ = db.InsertPriceHistoryIgnore(ctx, database.InsertPriceHistoryIgnoreParams{
					AssetID:    fund.ID,
					Price:      priceStr,
					RecordedAt: record.Date,
				})
			}

			if len(history) > 0 {
				processedFunds++
				slog.Info("✅  Fon geçmişi kaydedildi",
					"fon", fund.Symbol,
					"ilerleme", fmt.Sprintf("%d/%d", i+1, len(funds)),
					"veri_sayisi", len(history),
					"atlananlar", skippedFunds,
				)
			} else {
				slog.Warn("⚠️ Fon için hiç veri çekilemedi (WAF veya limitler yüzünden olabilir)",
					"fon", fund.Symbol,
					"ilerleme", fmt.Sprintf("%d/%d", i+1, len(funds)),
				)
			}

			time.Sleep(5 * time.Second) // WAF koruması (Artırıldı)
		}
		slog.Info("TEFAS fonlarının fiyat geçmişleri başarıyla senkronize edildi!",
			"yeni_islenen", processedFunds,
			"onceden_kayitli_atlanan", skippedFunds,
		)
	}
}
