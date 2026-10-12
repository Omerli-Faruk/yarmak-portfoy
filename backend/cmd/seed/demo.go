package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"yarmak/internal/services"
)

// Demo hesabı yalnızca yerel deneme içindir; şifre herkesin bildiği bir değer.
const (
	demoUsername = "demo"
	demoEmail    = "demo@yarmak.local"
	demoPassword = "demo12345"
)

// demoTrade, demo portföydeki bir işlem. Lot verilmezse bütçeye göre hesaplanır; fiyat o günün kapanışıdır.
type demoTrade struct {
	Symbol  string
	Type    string // varlık tipi (HISSE, FON, ALTIN, DOVIZ)
	Side    string // BUY / SELL
	DaysAgo int
	Budget  float64 // TL; alımlarda lot = bütçe / fiyat
	Lot     float64 // satışlarda doğrudan lot
}

var demoTrades = []demoTrade{
	{Symbol: "THYAO", Type: "HISSE", Side: "BUY", DaysAgo: 180, Budget: 30000},
	{Symbol: "TTA", Type: "FON", Side: "BUY", DaysAgo: 165, Budget: 20000},
	{Symbol: "ASELS", Type: "HISSE", Side: "BUY", DaysAgo: 150, Budget: 25000},
	{Symbol: "ALTIN", Type: "ALTIN", Side: "BUY", DaysAgo: 140, Budget: 25000},
	{Symbol: "USDTRY", Type: "DOVIZ", Side: "BUY", DaysAgo: 130, Budget: 20000},
	{Symbol: "BIMAS", Type: "HISSE", Side: "BUY", DaysAgo: 120, Budget: 20000},
	{Symbol: "THYAO", Type: "HISSE", Side: "SELL", DaysAgo: 45, Lot: 40},
}

// demoDividends, hisse başına brüt temettü (TL). Stopaj %15.
var demoDividends = []struct {
	Symbol   string
	DaysAgo  int
	PerShare float64
}{
	{"THYAO", 60, 3.10},
	{"BIMAS", 30, 7.50},
}

// seedDemo, demo kullanıcısını ve küçük bir örnek portföyü oluşturur. Kullanıcının işlemi zaten varsa dokunmaz.
func seedDemo(ctx context.Context, q *database.Queries, svc *services.Services) error {
	user, err := q.GetUserByUsername(ctx, demoUsername)
	if errors.Is(err, sql.ErrNoRows) {
		hash, hErr := auth.HashPassword(demoPassword)
		if hErr != nil {
			return hErr
		}
		user, err = q.CreateUser(ctx, database.CreateUserParams{Email: demoEmail, PasswordHash: hash, Username: demoUsername})
	}
	if err != nil {
		return fmt.Errorf("demo kullanıcısı hazırlanamadı: %w", err)
	}

	existing, err := q.GetAllUserTransactions(ctx, user.ID)
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		fmt.Printf("Demo hesabında zaten %d işlem var, yeniden eklenmedi.\n", len(existing))
		return nil
	}

	now := time.Now()
	assets := map[string]database.Asset{}
	history := map[string][]scraper.StockHistoricalRecord{}
	for _, t := range demoTrades {
		if _, ok := assets[t.Symbol]; ok {
			continue
		}
		a, err := svc.Asset.GetOrCreateAssetBySymbol(ctx, t.Symbol, t.Type)
		if err != nil {
			return fmt.Errorf("%s varlığı alınamadı: %w", t.Symbol, err)
		}
		assets[t.Symbol] = a
		history[t.Symbol] = demoHistory(ctx, q, a, now)
	}

	// Temettü tutarı o tarihte eldeki lota göre hesaplanıyor; lot değişimlerini burada tutuyoruz.
	changes := map[string][]lotChange{}
	for _, t := range demoTrades {
		a := assets[t.Symbol]
		date := demoDate(now, t.DaysAgo)
		price := priceAt(history[t.Symbol], date, parseFloat(a.CurrentPrice))
		if price <= 0 {
			return fmt.Errorf("%s için fiyat bulunamadı", t.Symbol)
		}
		lot := t.Lot
		if t.Side == "BUY" {
			lot = math.Floor(t.Budget / price)
			if t.Type == "ALTIN" {
				lot = math.Floor(t.Budget/price*100) / 100
			}
		}
		commission := 0.0
		if t.Type == "HISSE" {
			commission = math.Round(lot*price*0.002*100) / 100 // binde 2 aracı kurum komisyonu
		}
		if _, err := svc.Transaction.CreateTransaction(ctx, user.ID, services.CreateTransactionDTO{
			AssetID:         a.ID,
			Type:            t.Side,
			Amount:          fmt.Sprintf("%.6f", lot),
			Price:           fmt.Sprintf("%.6f", price),
			Commission:      fmt.Sprintf("%.2f", commission),
			TransactionDate: date,
		}); err != nil {
			return fmt.Errorf("%s %s işlemi eklenemedi: %w", t.Symbol, t.Side, err)
		}
		fmt.Printf("  %-6s %-4s %10.2f × %10.4f TL (%s)\n", t.Symbol, t.Side, lot, price, date.Format("2006-01-02"))
		if t.Side == "SELL" {
			lot = -lot
		}
		changes[t.Symbol] = append(changes[t.Symbol], lotChange{at: date, lot: lot})
	}

	for _, d := range demoDividends {
		date := demoDate(now, d.DaysAgo)
		lots := lotsAt(changes[d.Symbol], date)
		gross := math.Round(lots*d.PerShare*100) / 100
		tax := math.Round(gross*0.15*100) / 100
		net := gross - tax
		if _, err := q.CreateDividend(ctx, database.CreateDividendParams{
			UserID:      user.ID,
			AssetID:     assets[d.Symbol].ID,
			Amount:      fmt.Sprintf("%.6f", net),
			PaymentDate: date,
			GrossAmount: fmt.Sprintf("%.6f", gross),
			TaxAmount:   fmt.Sprintf("%.6f", tax),
			NetAmount:   fmt.Sprintf("%.6f", net),
		}); err != nil {
			return fmt.Errorf("%s temettüsü eklenemedi: %w", d.Symbol, err)
		}
		fmt.Printf("  %-6s temettü net %.2f TL (%s)\n", d.Symbol, net, date.Format("2006-01-02"))
	}

	fmt.Printf("Demo hesabı hazır: kullanıcı adı %q, şifre %q (yalnızca yerel deneme için)\n", demoUsername, demoPassword)
	return nil
}

type lotChange struct {
	at  time.Time
	lot float64
}

// lotsAt, verilen tarihte eldeki lot.
func lotsAt(changes []lotChange, at time.Time) float64 {
	total := 0.0
	for _, c := range changes {
		if !c.at.After(at) {
			total += c.lot
		}
	}
	return total
}

// demoHistory, varlığın son ~7 aylık günlük fiyatları. Fon geçmişi TEFAS'tan çekilip veritabanına da yazılır
// (portföy grafiği fonlar için veritabanını kullanıyor). Alınamazsa boş döner; güncel fiyat kullanılır.
func demoHistory(ctx context.Context, q *database.Queries, a database.Asset, now time.Time) []scraper.StockHistoricalRecord {
	var out []scraper.StockHistoricalRecord
	if a.AssetType == "FON" {
		funds, err := scraper.FetchTEFASFundHistory(a.Symbol, now.AddDate(0, -7, 0), now)
		if err != nil {
			fmt.Printf("  uyarı: %s fon geçmişi tam alınamadı: %v\n", a.Symbol, err)
		}
		for _, f := range funds {
			if f.Price <= 0 {
				continue
			}
			out = append(out, scraper.StockHistoricalRecord{Date: f.Date, Price: f.Price})
			_ = q.UpsertPriceHistory(ctx, database.UpsertPriceHistoryParams{
				AssetID: a.ID, Price: fmt.Sprintf("%.6f", f.Price), RecordedAt: f.Date.UTC(),
			})
		}
	} else {
		_, hist, err := scraper.FetchBISTHistory(a.Symbol, "1y")
		if err != nil {
			fmt.Printf("  uyarı: %s geçmişi alınamadı: %v\n", a.Symbol, err)
		}
		out = hist
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date.Before(out[j].Date) })
	return out
}

// priceAt, verilen tarihteki (ya da hemen önceki) kapanışı döner; geçmiş yoksa yedek fiyatı.
func priceAt(hist []scraper.StockHistoricalRecord, at time.Time, fallback float64) float64 {
	price := fallback
	for _, h := range hist {
		if h.Date.After(at) {
			break
		}
		price = h.Price
	}
	return math.Round(price*10000) / 10000
}

// demoDate, bugünden daysAgo gün önceki hafta içi günün 14:00'ü (İstanbul).
func demoDate(now time.Time, daysAgo int) time.Time {
	trt := time.FixedZone("TRT", 3*3600)
	d := now.In(trt).AddDate(0, 0, -daysAgo)
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		d = d.AddDate(0, 0, -1)
	}
	return time.Date(d.Year(), d.Month(), d.Day(), 14, 0, 0, 0, trt)
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
