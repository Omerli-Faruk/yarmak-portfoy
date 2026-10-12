package services

import (
	"context"
	"slices"
	"testing"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
)

// GetValueHistory uçtan uca: 1 yıllık portföyde 5Y istenince ilk nokta ilk işlemde, toplam değişim
// özetteki toplam kâr ve getiriyle aynı. Fiyatlar sahte kaynaktan, saat sabit.
func TestGetValueHistory_YoungPortfolioMatchesSummary(t *testing.T) {
	now := histNow
	first := now.AddDate(-1, 0, 0)
	q := newFakeQuerier(asset(1, "THYAO", "HISSE", 130), asset(2, "TTA", "FON", 55))
	q.txs = []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 5, first, 0),
		histTx(2, 2, "BUY", 20, 50, 0, now.AddDate(0, 0, -300), 0),
		histTx(3, 2, "SELL", 10, 60, 2, now.AddDate(0, 0, -100), 98),
	}
	q.dividends = []database.GetUserDividendsRow{dividendRow(1, now.AddDate(0, 0, -50), 30)}
	// Fon geçmişi veritabanından gelir; portföyden çok daha eskiye gidiyor.
	q.priceHistory[2] = dbRows(2, flatSeries(now.AddDate(-2, 0, 0), now.Add(-oneDay), 52))

	prices := &fakePrices{
		history: map[string][]scraper.StockHistoricalRecord{
			// 1 yıllık portföy için 2 yıllık günlük veri istenmeli (bkz. yahooPlanForSpan)
			"THYAO|2y|1d": records(flatSeries(now.AddDate(-2, 0, 0), now.Add(-oneDay), 90)),
		},
		prices: map[string]float64{"USDTRY": 40},
	}
	s := newTestPortfolioService(q, prices, now)

	res, err := s.GetValueHistory(context.Background(), 1, "5Y")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(prices.calls, "THYAO|2y|1d") {
		t.Fatalf("hisse geçmişi 2y/1d istenmeliydi, çağrılar: %v", prices.calls)
	}
	if len(res.Points) < 3 {
		t.Fatalf("en az 3 nokta bekleniyordu, %d geldi", len(res.Points))
	}
	p0, last := res.Points[0], res.Points[len(res.Points)-1]
	if !p0.T.Equal(first) || p0.Value != 1005 || p0.PnL != 0 {
		t.Fatalf("ilk nokta ilk işlemde, maliyetle olmalı: %+v", p0)
	}
	if !last.T.Equal(now) {
		t.Fatalf("son nokta sabit saatte olmalı: %v", last.T)
	}

	sum, err := s.CalculatePortfolioSummary(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if !near(res.PnLChange, sum.TotalCombinedProfit) || !near(res.PnLChangePct, sum.TotalReturnPercentage) {
		t.Fatalf("5Y değişim %.2f (%%%.2f), özetteki toplam kâr %.2f (%%%.2f) olmalı",
			res.PnLChange, res.PnLChangePct, sum.TotalCombinedProfit, sum.TotalReturnPercentage)
	}
	if !near(last.Value, sum.TotalEquityValue) {
		t.Fatalf("son nokta değeri %.2f, özetteki %.2f olmalı", last.Value, sum.TotalEquityValue)
	}

	// Aynı veriyle ikinci çağrı önbellekten döner; kaynağa tekrar gidilmez.
	calls := len(prices.calls)
	if _, err := s.GetValueHistory(context.Background(), 1, "5Y"); err != nil {
		t.Fatal(err)
	}
	if len(prices.calls) != calls {
		t.Fatalf("ikinci çağrı önbellekten dönmeliydi: %v", prices.calls)
	}
}

// 1G pazar günü: seans cuma, baseline perşembe kapanışı; hisse Yahoo'dan, fon veritabanından gelir.
func TestGetValueHistory_OneDayWeekend(t *testing.T) {
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, turkeyZone) }
	now := at(11, 12, 0) // pazar
	bought := time.Date(2026, 9, 1, 12, 0, 0, 0, turkeyZone)

	q := newFakeQuerier(asset(1, "THYAO", "HISSE", 103), asset(2, "TTA", "FON", 20.5))
	q.txs = []database.Transaction{
		histTx(1, 1, "BUY", 10, 90, 0, bought, 0),
		histTx(2, 2, "BUY", 5, 18, 0, bought, 0),
	}
	q.priceHistory[2] = dbRows(2, []PricePoint{{T: at(7, 0, 0), Price: 19.8}, {T: at(8, 0, 0), Price: 20}, {T: at(9, 0, 0), Price: 20.5}})

	var intraday []PricePoint
	for m := 0; m < 8*60; m += 5 {
		intraday = append(intraday, PricePoint{T: at(9, 10, 0).Add(time.Duration(m) * time.Minute), Price: 102 + float64(m)/480})
	}
	prices := &fakePrices{history: map[string][]scraper.StockHistoricalRecord{
		"THYAO|1d|5m":  records(intraday),
		"THYAO|1mo|1d": records([]PricePoint{{T: at(8, 10, 0), Price: 100}, {T: at(9, 10, 0), Price: 103}}),
	}}
	s := newTestPortfolioService(q, prices, now)

	res, err := s.GetValueHistory(context.Background(), 1, "1D")
	if err != nil {
		t.Fatal(err)
	}
	friOpen := at(9, 10, 0)
	if !res.Start.Equal(friOpen) {
		t.Fatalf("pazar günü başlangıç cuma 10:00 olmalı: %v", res.Start)
	}
	if res.Baseline == nil || !near(res.Baseline.Value, 10*100+5*20) {
		t.Fatalf("baseline perşembe kapanışıyla (1100) olmalı: %+v", res.Baseline)
	}
	// Σ lot × (güncel - perşembe kapanışı) = 10×3 + 5×0,5
	if !near(res.PnLChange, 32.5) {
		t.Fatalf("1G değişim 32,5 olmalı, gelen %v", res.PnLChange)
	}
	last := res.Points[len(res.Points)-1]
	if !last.T.Equal(now) || !near(last.Value, 10*103+5*20.5) {
		t.Fatalf("son nokta güncel fiyatlarla şimdi olmalı: %+v", last)
	}
}

func TestGetValueHistory_InvalidRange(t *testing.T) {
	s := newTestPortfolioService(newFakeQuerier(), &fakePrices{}, histNow)
	if _, err := s.GetValueHistory(context.Background(), 1, "2W"); err == nil {
		t.Fatal("geçersiz aralık hata vermeli")
	}
}
