package services

import (
	"context"
	"testing"
	"time"
	"yarmak/internal/database"
)

// summaryFixture: hisse (kârda), kısmen satılmış fon, güncel fiyatı olmayan altın ve bir temettü.
func summaryFixture() *fakeQuerier {
	q := newFakeQuerier(
		asset(1, "THYAO", "HISSE", 130),
		asset(2, "TTA", "FON", 55),
		asset(3, "ALTIN", "ALTIN", 0), // fiyat yok: ortalama maliyetle değerlenmeli
		asset(4, "USDTRY", "DOVIZ", 50),
	)
	base := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	q.txs = []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 5, base, 0), // ort. maliyet 100,5
		histTx(2, 2, "BUY", 20, 50, 0, base.AddDate(0, 0, 10), 0),
		histTx(3, 2, "SELL", 10, 60, 2, base.AddDate(0, 1, 0), 98), // 10 × (60 - 50) - 2
		histTx(4, 3, "BUY", 2, 3000, 0, base.AddDate(0, 2, 0), 0),
	}
	q.dividends = []database.GetUserDividendsRow{dividendRow(1, base.AddDate(0, 3, 0), 30)}
	return q
}

func TestCalculatePortfolioSummary_Totals(t *testing.T) {
	q := summaryFixture()
	q.periodValues = &database.GetPortfolioPeriodValuesRow{ValCur: 7850, Val1d: 7800}
	s := NewPortfolioService(q, &fakePrices{})

	got, err := s.CalculatePortfolioSummary(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}

	// değer: 10×130 + 10×55 + 2×3000 = 7850, maliyet: 1005 + 500 + 6000 = 7505
	checks := []struct {
		name      string
		got, want float64
	}{
		{"TotalEquityValue", got.TotalEquityValue, 7850},
		{"TotalValue (temettü dahil)", got.TotalValue, 7880},
		{"TotalCost", got.TotalCost, 7505},
		{"CapitalProfitLoss", got.CapitalProfitLoss, 345},
		{"CapitalProfitLossPercentage", got.CapitalProfitLossPercentage, 4.6},
		{"TotalDividends", got.TotalDividends, 30},
		{"RealizedProfitLoss", got.RealizedProfitLoss, 98},
		{"TotalCombinedProfit (345 + 98 + 30)", got.TotalCombinedProfit, 473},
		{"TotalReturnPercentage", got.TotalReturnPercentage, 6.3},
		{"TotalCommission", got.TotalCommission, 7},
		{"USDRate", got.USDRate, 50},
		{"TotalValueUSD", got.TotalValueUSD, 157.6},
		{"TotalCombinedProfitUSD", got.TotalCombinedProfitUSD, 9.46},
		{"PeriodReturns[1D]", got.PeriodReturns["1D"], 0.64},
		{"PeriodReturns[ALL]", got.PeriodReturns["ALL"], 4.6},
		{"PeriodValues[1D]", got.PeriodValues["1D"], 7800},
	}
	for _, c := range checks {
		if !near(c.got, c.want) {
			t.Errorf("%s = %v, beklenen %v", c.name, c.got, c.want)
		}
	}
	if got.HoldingsCount != 3 {
		t.Errorf("HoldingsCount = %d, beklenen 3", got.HoldingsCount)
	}

	wantBreakdown := map[string]AssetCategorySummary{
		"HISSE":   {Value: 1300, Cost: 1005, ProfitLoss: 295},
		"FON":     {Value: 550, Cost: 500, ProfitLoss: 50},
		"ALTIN":   {Value: 6000, Cost: 6000, ProfitLoss: 0},
		"DOVIZ":   {},
		"TEMETTU": {Value: 30, Cost: 0, ProfitLoss: 30},
	}
	for k, want := range wantBreakdown {
		b := got.Breakdown[k]
		if b == nil || !near(b.Value, want.Value) || !near(b.Cost, want.Cost) || !near(b.ProfitLoss, want.ProfitLoss) {
			t.Errorf("Breakdown[%s] = %+v, beklenen %+v", k, b, want)
		}
	}
}

// USDTRY veritabanında yoksa kur fiyat kaynağından alınır; dönemsel değer yoksa dönem getirileri boş kalır.
func TestCalculatePortfolioSummary_USDFallbackAndNoPeriods(t *testing.T) {
	q := summaryFixture()
	delete(q.assets, 4)
	s := NewPortfolioService(q, &fakePrices{prices: map[string]float64{"USDTRY": 40}})

	got, err := s.CalculatePortfolioSummary(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if got.USDRate != 40 || !near(got.TotalValueUSD, 197) {
		t.Fatalf("kur kaynaktan gelmeli: kur %v, dolar değeri %v", got.USDRate, got.TotalValueUSD)
	}
	if len(got.PeriodReturns) != 0 {
		t.Fatalf("dönemsel değer yokken getiri olmamalı: %v", got.PeriodReturns)
	}
}
