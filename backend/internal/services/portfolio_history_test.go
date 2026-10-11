package services

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"
	"time"
	"yarmak/internal/database"
)

var histNow = time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)

func histTx(id, assetID int64, typ string, amount, price, commission float64, at time.Time, realized float64) database.Transaction {
	return database.Transaction{
		ID:              id,
		AssetID:         assetID,
		Type:            typ,
		Amount:          fmt.Sprintf("%.6f", amount),
		Price:           fmt.Sprintf("%.6f", price),
		Commission:      fmt.Sprintf("%.6f", commission),
		RealizedPnl:     fmt.Sprintf("%.6f", realized),
		TransactionDate: at,
	}
}

// flatSeries, from'dan to'ya her gün aynı fiyatı üretir.
func flatSeries(from, to time.Time, price float64) []PricePoint {
	var pts []PricePoint
	for t := from; !t.After(to); t = t.Add(oneDay) {
		pts = append(pts, PricePoint{T: t, Price: price})
	}
	return pts
}

// summaryTotals, CalculatePortfolioSummary'deki toplam kâr ve toplam getiri formülünün DB'siz kopyası.
func summaryTotals(txs []database.Transaction, divs []HistoryDividend, current map[int64]float64) (combined, pct float64) {
	byAsset := map[int64][]database.Transaction{}
	realized := 0.0
	for _, tx := range txs {
		byAsset[tx.AssetID] = append(byAsset[tx.AssetID], tx)
		if tx.Type == "SELL" {
			realized += parseFloatSafe(tx.RealizedPnl)
		}
	}
	var value, cost, div float64
	for id, list := range byAsset {
		qty, avg := CalculateAssetHoldingAndCost(list)
		if qty <= 0 {
			continue
		}
		price := current[id]
		if price <= 0 {
			price = avg
		}
		value += price * qty
		cost += avg * qty
	}
	for _, d := range divs {
		div += d.Net
	}
	combined = value - cost + realized + div
	if cost > 0 {
		pct = combined / cost * 100
	}
	return round2(combined), round2(pct)
}

func near(a, b float64) bool { return math.Abs(a-b) < 0.011 }

// (a) Portföy 1 yıl önce başladı, 5Y istendi: ilk nokta ilk işlemde, değişim yüzdesi özetteki toplam getiriye eşit.
func TestValueHistory_YoungPortfolioLongRange(t *testing.T) {
	first := histNow.AddDate(-1, 0, 0)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 5, first, 0),
		histTx(2, 2, "BUY", 20, 50, 0, histNow.AddDate(0, 0, -300), 0),
		// 10 × (60 - 50) - 2 = 98
		histTx(3, 2, "SELL", 10, 60, 2, histNow.AddDate(0, 0, -100), 98),
	}
	divs := []HistoryDividend{{Date: histNow.AddDate(0, 0, -50), Net: 30}}
	current := map[int64]float64{1: 130, 2: 55}

	// Fiyat geçmişi portföyden çok daha eskiye gidiyor; bunların kullanılmaması gerekir.
	s1 := flatSeries(histNow.AddDate(-5, 0, 0), histNow.Add(-oneDay), 90)
	s1 = append(s1, PricePoint{T: histNow, Price: current[1]})
	s2 := flatSeries(histNow.AddDate(-5, 0, 0), histNow.Add(-oneDay), 52)
	s2 = append(s2, PricePoint{T: histNow, Price: current[2]})

	res := BuildValueHistory(ValueHistoryInput{
		Range:        "5Y",
		Transactions: txs,
		Dividends:    divs,
		Prices:       map[int64][]PricePoint{1: s1, 2: s2},
		Start:        histNow.AddDate(-5, 0, 0),
		End:          histNow,
		Step:         7 * oneDay,
	})

	if len(res.Points) < 3 {
		t.Fatalf("en az 3 nokta bekleniyordu, %d geldi", len(res.Points))
	}
	p0 := res.Points[0]
	if !p0.T.Equal(first) || !res.Start.Equal(first) {
		t.Fatalf("ilk nokta ilk işlem anında olmalı: %v (start %v), beklenen %v", p0.T, res.Start, first)
	}
	if p0.Value != 1005 || p0.Cost != 1005 || p0.PnL != 0 {
		t.Fatalf("ilk nokta maliyetle değerlenmeli: %+v", p0)
	}
	for _, p := range res.Points {
		if p.T.Before(first) {
			t.Fatalf("ilk işlemden önce nokta olmamalı: %v", p.T)
		}
	}

	combined, pct := summaryTotals(txs, divs, current)
	last := res.Points[len(res.Points)-1]
	if !last.T.Equal(histNow) {
		t.Fatalf("son nokta şimdi olmalı: %v", last.T)
	}
	if !near(last.PnL, combined) || !near(res.PnLChange, combined) {
		t.Fatalf("son pnl %.2f / değişim %.2f, özetteki toplam kâr %.2f olmalı", last.PnL, res.PnLChange, combined)
	}
	if !near(res.PnLChangePct, pct) {
		t.Fatalf("pnl_change_pct %.2f, özetteki toplam getiri %.2f olmalı", res.PnLChangePct, pct)
	}
}

// (b) Aralığın ortasındaki satış: gerçekleşen kâr pnl'de kalır, maliyet düşer.
func TestValueHistory_SellInMiddleCarriesRealized(t *testing.T) {
	sellAt := histNow.AddDate(0, 0, -100)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 0, histNow.AddDate(-2, 0, 0), 0),
		histTx(2, 1, "SELL", 5, 150, 0, sellAt, 250),
	}
	start := histNow.AddDate(-1, 0, 0)
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1Y",
		Transactions: txs,
		Prices:       map[int64][]PricePoint{1: flatSeries(histNow.AddDate(-3, 0, 0), histNow, 150)},
		Start:        start,
		End:          histNow,
		Step:         oneDay,
	})
	if len(res.Points) == 0 || !res.Points[0].T.Equal(start) {
		t.Fatalf("eski portföyde ilk nokta aralık başı olmalı: %+v", res.Points)
	}
	sawBefore, sawAfter := false, false
	for _, p := range res.Points {
		if p.PnL != 500 {
			t.Fatalf("pnl satıştan bağımsız 500 kalmalı: %+v", p)
		}
		if p.T.Before(sellAt) {
			sawBefore = true
			if p.Cost != 1000 || p.Value != 1500 {
				t.Fatalf("satış öncesi yanlış: %+v", p)
			}
		} else {
			sawAfter = true
			if p.Cost != 500 || p.Value != 750 {
				t.Fatalf("satış sonrası yanlış: %+v", p)
			}
		}
	}
	if !sawBefore || !sawAfter {
		t.Fatal("satışın iki tarafında da nokta olmalı")
	}
	if res.PnLChange != 0 || res.PnLChangePct != 0 {
		t.Fatalf("fiyat değişmediği için değişim 0 olmalı: %v / %v", res.PnLChange, res.PnLChangePct)
	}
}

// (c) Aralığın ortasındaki alım kâr sayılmaz: değer ve maliyet birlikte artar.
func TestValueHistory_BuyInMiddleIsNotProfit(t *testing.T) {
	buyAt := histNow.AddDate(0, 0, -100)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 0, histNow.AddDate(-2, 0, 0), 0),
		histTx(2, 1, "BUY", 10, 120, 0, buyAt, 0),
	}
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1Y",
		Transactions: txs,
		Prices:       map[int64][]PricePoint{1: flatSeries(histNow.AddDate(-3, 0, 0), histNow, 120)},
		Start:        histNow.AddDate(-1, 0, 0),
		End:          histNow,
		Step:         oneDay,
	})
	for _, p := range res.Points {
		if p.PnL != 200 {
			t.Fatalf("alım pnl'i değiştirmemeli: %+v", p)
		}
	}
	first, last := res.Points[0], res.Points[len(res.Points)-1]
	if first.Value != 1200 || last.Value != 2400 || last.Cost != 2200 {
		t.Fatalf("değer/maliyet yanlış: ilk %+v son %+v", first, last)
	}
	if res.PnLChange != 0 || res.PnLChangePct != 0 {
		t.Fatalf("alım değişim yaratmamalı: %v / %v", res.PnLChange, res.PnLChangePct)
	}
}

// (d) Temettü ödendiği andan itibaren pnl'e eklenir.
func TestValueHistory_DividendsAddToPnL(t *testing.T) {
	divAt := histNow.AddDate(0, 0, -100)
	txs := []database.Transaction{histTx(1, 1, "BUY", 10, 100, 0, histNow.AddDate(-2, 0, 0), 0)}
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1Y",
		Transactions: txs,
		Dividends:    []HistoryDividend{{Date: divAt, Net: 40}},
		Prices:       map[int64][]PricePoint{1: flatSeries(histNow.AddDate(-3, 0, 0), histNow, 100)},
		Start:        histNow.AddDate(-1, 0, 0),
		End:          histNow,
		Step:         oneDay,
	})
	for _, p := range res.Points {
		want := 0.0
		if !p.T.Before(divAt) {
			want = 40
		}
		if p.PnL != want {
			t.Fatalf("%v anında pnl %v, beklenen %v", p.T, p.PnL, want)
		}
	}
	if res.PnLChange != 40 || res.PnLChangePct != 4 {
		t.Fatalf("değişim 40 / %%4 olmalı: %v / %v", res.PnLChange, res.PnLChangePct)
	}
}

// (e) İşlem yoksa boş liste ve sıfırlar; JSON'da points [] olmalı.
func TestValueHistory_Empty(t *testing.T) {
	res := BuildValueHistory(ValueHistoryInput{Range: "1Y", Start: histNow.AddDate(-1, 0, 0), End: histNow, Step: oneDay})
	if res.Points == nil || len(res.Points) != 0 || res.PnLChange != 0 || res.PnLChangePct != 0 {
		t.Fatalf("boş sonuç bekleniyordu: %+v", res)
	}
	b, err := json.Marshal(res)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"range", "points", "pnl_change", "pnl_change_pct", "start", "end"} {
		if _, ok := m[k]; !ok {
			t.Fatalf("JSON'da %q alanı yok: %s", k, b)
		}
	}
	if pts, ok := m["points"].([]any); !ok || len(pts) != 0 {
		t.Fatalf("points boş dizi olmalı: %s", b)
	}
}

// Eski portföyde ilk nokta aralık başıdır ve başlangıçtan önceki son fiyatla değerlenir, aralıktaki ilk mumla değil.
func TestValueHistory_StartUsesLastPriceBeforeStart(t *testing.T) {
	txs := []database.Transaction{histTx(1, 1, "BUY", 1, 10, 0, histNow.AddDate(-2, 0, 0), 0)}
	start := histNow.AddDate(0, -1, 0)
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1M",
		Transactions: txs,
		Prices: map[int64][]PricePoint{1: {
			{T: start.Add(-3 * oneDay), Price: 9},
			{T: histNow.AddDate(0, 0, -10), Price: 11},
			{T: histNow.AddDate(0, 0, -5), Price: 12},
		}},
		Start: start,
		End:   histNow,
		Step:  time.Hour,
	})
	if len(res.Points) != 4 {
		t.Fatalf("4 nokta bekleniyordu (başlangıç + iki fiyat + şimdi): %+v", res.Points)
	}
	if !res.Points[0].T.Equal(start) || !res.Start.Equal(start) || res.Points[0].Value != 9 {
		t.Fatalf("ilk nokta aralık başında, önceki kapanışla (9) olmalı: %+v", res.Points[0])
	}
	if res.Points[3].Value != 12 {
		t.Fatalf("son fiyat ileri taşınmalı: %+v", res.Points[3])
	}
	if res.PnLChange != 3 {
		t.Fatalf("değişim 12 - 9 = 3 olmalı: %v", res.PnLChange)
	}
	// json'da zaman RFC3339 olmalı
	b, _ := json.Marshal(res.Points[0])
	var p struct{ T string }
	_ = json.Unmarshal(b, &p)
	if _, err := time.Parse(time.RFC3339, p.T); err != nil {
		t.Fatalf("zaman RFC3339 değil: %s", p.T)
	}
}

// Aynı dilimdeki zamanlar tek noktaya iner.
func TestValueHistory_Bucketing(t *testing.T) {
	txs := []database.Transaction{histTx(1, 1, "BUY", 1, 10, 0, histNow.AddDate(-1, 0, 0), 0)}
	base := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	var series []PricePoint
	for h := 0; h < 48; h++ {
		series = append(series, PricePoint{T: base.Add(time.Duration(h) * time.Hour), Price: 10 + float64(h)})
	}
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1W",
		Transactions: txs,
		Prices:       map[int64][]PricePoint{1: series},
		Start:        base,
		End:          histNow,
		Step:         oneDay,
	})
	// başlangıç + 5 Ekim'in son saati + 6 Ekim'in son saati + şimdi
	if len(res.Points) != 4 {
		t.Fatalf("4 nokta bekleniyordu: %+v", res.Points)
	}
	if res.Points[1].Value != 33 || res.Points[2].Value != 57 {
		t.Fatalf("dilimin son fiyatı kullanılmalı: %+v", res.Points)
	}
}

func TestNormalizeValueHistoryRange(t *testing.T) {
	cases := map[string]struct {
		want string
		ok   bool
	}{
		"": {"1Y", true}, "1d": {"1D", true}, " ytd ": {"YTD", true}, "5Y": {"5Y", true},
		"ALL": {"ALL", false}, "2Y": {"2Y", false}, "abc": {"ABC", false},
	}
	for in, c := range cases {
		got, ok := NormalizeValueHistoryRange(in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("%q: %q/%v, beklenen %q/%v", in, got, ok, c.want, c.ok)
		}
	}
}

// Seçilen Yahoo aralığı, başlangıçtan önceki fiyatı da getirecek kadar geniş olmalı.
func TestYahooPlanForSpan(t *testing.T) {
	cases := []struct {
		span time.Duration
		want yahooPlan
	}{
		{7 * oneDay, yahooPlan{"1mo", "30m"}},       // 1W
		{31 * oneDay, yahooPlan{"3mo", "1h"}},       // 1M
		{92 * oneDay, yahooPlan{"6mo", "1h"}},       // 3M
		{184 * oneDay, yahooPlan{"1y", "1d"}},       // 6M
		{366 * oneDay, yahooPlan{"2y", "1d"}},       // 1Y
		{3 * 366 * oneDay, yahooPlan{"5y", "1wk"}},  // 3Y
		{5 * 366 * oneDay, yahooPlan{"10y", "1wk"}}, // 5Y
	}
	for _, c := range cases {
		if got := yahooPlanForSpan(c.span); got != c.want {
			t.Errorf("%v: %+v, beklenen %+v", c.span, got, c.want)
		}
	}
}

// Aralıkta alınan varlığın son mumu alımdan eskiyse bile pozisyon maliyetiyle girer, sahte kâr/zarar oluşmaz.
func TestValueHistory_EntryAtCostWithStalePrice(t *testing.T) {
	buyAt := histNow.AddDate(0, 0, -50)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 0, histNow.AddDate(-2, 0, 0), 0),
		histTx(2, 2, "BUY", 5, 50, 0, buyAt, 0),
	}
	res := BuildValueHistory(ValueHistoryInput{
		Range:        "1Y",
		Transactions: txs,
		Prices: map[int64][]PricePoint{
			1: flatSeries(histNow.AddDate(-2, 0, 0), histNow, 100),
			// varlık 2'nin son mumu alımdan 10 gün önce ve alış fiyatından düşük
			2: {{T: histNow.AddDate(0, 0, -60), Price: 40}},
		},
		Start: histNow.AddDate(-1, 0, 0),
		End:   histNow,
		Step:  oneDay,
	})
	sawAfter := false
	for _, p := range res.Points {
		if p.PnL != 0 {
			t.Fatalf("%v anında pnl 0 olmalı (eski mumla sahte zarar): %+v", p.T, p)
		}
		if p.T.After(buyAt) {
			sawAfter = true
			if p.Value != 1250 || p.Cost != 1250 {
				t.Fatalf("alım sonrası değer/maliyet 1250 olmalı: %+v", p)
			}
		}
	}
	if !sawAfter {
		t.Fatal("alımdan sonra nokta olmalı")
	}
}

// 1G hafta içi: ilk nokta seans açılışında (10:00) ve önceki kapanışla değerlenir; değişim Σ lot × (son - önceki kapanış).
func TestOneDay_BaselineIsPreviousClose(t *testing.T) {
	trt := turkeyZone
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, trt) }
	now := at(7, 14, 0) // çarşamba
	bought := at(1, 12, 0)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 90, 0, bought, 0),  // hisse
		histTx(2, 2, "BUY", 5, 18, 0, bought, 0),   // fon
		histTx(3, 3, "BUY", 2, 2900, 0, bought, 0), // altın
	}

	// hisse: günlük mumlar (zaman damgası seans açılışı) + bugünün 5 dakikalıkları; açılış önceki kapanıştan yukarıda
	stockDaily := []PricePoint{{T: at(5, 10, 0), Price: 98}, {T: at(6, 10, 0), Price: 100}, {T: at(7, 10, 0), Price: 104}}
	var stockIntraday []PricePoint
	for m := 0; m < 240; m += 5 {
		stockIntraday = append(stockIntraday, PricePoint{T: at(7, 10, 0).Add(time.Duration(m) * time.Minute), Price: 101 + float64(m)/80})
	}
	// fon: veritabanı kayıtları gün başında (gün tarihli)
	fund := []PricePoint{{T: at(5, 0, 0), Price: 19}, {T: at(6, 0, 0), Price: 20}, {T: at(7, 0, 0), Price: 21}}
	// altın: gece de işlem görüyor; açılıştan önceki son fiyat 3000
	goldDaily := []PricePoint{{T: at(5, 7, 0), Price: 2940}, {T: at(6, 7, 0), Price: 2950}, {T: at(7, 7, 0), Price: 3005}}
	var goldIntraday []PricePoint
	for m := 0; m < 12*60+55; m += 5 {
		goldIntraday = append(goldIntraday, PricePoint{T: at(7, 1, 0).Add(time.Duration(m) * time.Minute), Price: 3000})
	}

	start, prices := buildOneDayPrices(map[int64]assetSeries{
		1: {Main: stockIntraday, Daily: stockDaily},
		2: {Main: fund},
		3: {Main: goldIntraday, Daily: goldDaily},
	}, now)
	if !start.Equal(at(7, 10, 0)) {
		t.Fatalf("başlangıç bugün 10:00 olmalı: %v", start)
	}
	current := map[int64]float64{1: 105, 2: 21, 3: 3010}
	for id, p := range current {
		prices[id] = append(prices[id], PricePoint{T: now, Price: p})
	}

	res := BuildValueHistory(ValueHistoryInput{Range: "1D", Transactions: txs, Prices: prices, Start: start, End: now, Step: 5 * time.Minute})
	first := res.Points[0]
	if !first.T.Equal(start) || first.Value != 10*100+5*20+2*2950 {
		t.Fatalf("ilk nokta açılışta önceki kapanışlarla değerlenmeli: %+v", first)
	}
	want := 10*(105-100) + 5*(21-20) + 2*(3010-2950)
	if res.PnLChange != float64(want) {
		t.Fatalf("1G değişim %v, beklenen Σ lot × (son - önceki kapanış) = %v", res.PnLChange, want)
	}
}

// 1G pazar günü: gösterilen seans cuma; önceki kapanış perşembe, perşembe kapanışı → cuma açılışı farkı da sayılır.
func TestOneDay_WeekendShowsFriday(t *testing.T) {
	trt := turkeyZone
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, trt) }
	now := at(11, 12, 0) // pazar
	bought := at(1, 12, 0)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 90, 0, bought, 0),
		histTx(2, 2, "BUY", 5, 18, 0, bought, 0),
		histTx(3, 3, "BUY", 100, 48, 0, bought, 0),
	}
	stockDaily := []PricePoint{{T: at(8, 10, 0), Price: 100}, {T: at(9, 10, 0), Price: 103}}
	var stockIntraday []PricePoint
	for m := 0; m < 8*60; m += 5 {
		stockIntraday = append(stockIntraday, PricePoint{T: at(9, 10, 0).Add(time.Duration(m) * time.Minute), Price: 102 + float64(m)/480})
	}
	fund := []PricePoint{{T: at(8, 0, 0), Price: 20}, {T: at(9, 0, 0), Price: 20.5}}
	// döviz: cuma seansı cumartesi 00:30'a kadar sürüyor; seans gününü cumartesiye kaydırmamalı
	fxDaily := []PricePoint{{T: at(8, 3, 0), Price: 49}, {T: at(9, 3, 0), Price: 49.26}}
	var fxIntraday []PricePoint
	for m := 0; m <= 22*60+30; m += 5 {
		fxIntraday = append(fxIntraday, PricePoint{T: at(9, 2, 0).Add(time.Duration(m) * time.Minute), Price: 49.26})
	}

	start, prices := buildOneDayPrices(map[int64]assetSeries{
		1: {Main: stockIntraday, Daily: stockDaily},
		2: {Main: fund},
		3: {Main: fxIntraday, Daily: fxDaily},
	}, now)
	friOpen := at(9, 10, 0)
	if !start.Equal(friOpen) {
		t.Fatalf("pazar günü başlangıç cuma 10:00 olmalı: %v", start)
	}
	current := map[int64]float64{1: 103, 2: 20.5, 3: 49.26}
	for id, p := range current {
		prices[id] = append(prices[id], PricePoint{T: now, Price: p})
	}
	res := BuildValueHistory(ValueHistoryInput{Range: "1D", Transactions: txs, Prices: prices, Start: start, End: now, Step: 5 * time.Minute})
	if !res.Start.Equal(friOpen) || res.Points[0].Value != 10*100+5*20+100*49 {
		t.Fatalf("ilk nokta cuma açılışında perşembe kapanışıyla olmalı: %+v", res.Points[0])
	}
	if res.PnLChange != 10*3+5*0.5+100*0.26 {
		t.Fatalf("değişim 58.5 olmalı (perşembe kapanışına göre), gelen %v", res.PnLChange)
	}
	// cuma açılışındaki boşluk (100 → 102) ilk seans noktalarında görünmeli
	if res.Points[1].Value <= res.Points[0].Value {
		t.Fatalf("açılış boşluğu kaybolmamalı: %+v", res.Points[:2])
	}
}

func TestValueHistoryCache(t *testing.T) {
	var c valueHistoryCache
	res := ValueHistoryResult{Range: "1Y", PnLChange: 5}
	c.put("1|1Y", 42, histNow, res)
	if got, ok := c.get("1|1Y", 42, histNow.Add(time.Minute)); !ok || got.PnLChange != 5 {
		t.Fatal("önbellekten dönmeliydi")
	}
	if _, ok := c.get("1|1Y", 43, histNow.Add(time.Minute)); ok {
		t.Fatal("işlemler değişince önbellek kullanılmamalı")
	}
	if _, ok := c.get("1|1Y", 42, histNow.Add(6*time.Minute)); ok {
		t.Fatal("5 dakika sonra önbellek geçersiz olmalı")
	}
}

// 1G hafta içi gece yarısından sonra: döviz mumları yeni güne geçse de gösterilen seans bir önceki gün kalır.
func TestOneDay_AfterMidnightKeepsPreviousSession(t *testing.T) {
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, turkeyZone) }
	now := at(6, 0, 45) // salı 00:45
	var stock, fx []PricePoint
	for m := 0; m < 8*60; m += 5 {
		stock = append(stock, PricePoint{T: at(5, 10, 0).Add(time.Duration(m) * time.Minute), Price: 100})
	}
	for m := 0; m <= 22*60+40; m += 5 {
		fx = append(fx, PricePoint{T: at(5, 2, 0).Add(time.Duration(m) * time.Minute), Price: 49})
	}
	start, _ := buildOneDayPrices(map[int64]assetSeries{
		1: {Main: stock, Daily: []PricePoint{{T: at(2, 10, 0), Price: 99}, {T: at(5, 10, 0), Price: 100}}},
		2: {Main: fx, Daily: []PricePoint{{T: at(2, 3, 0), Price: 48.9}, {T: at(5, 3, 0), Price: 49}}},
	}, now)
	if !start.Equal(at(5, 10, 0)) {
		t.Fatalf("seans pazartesi 10:00'dan başlamalı: %v", start.In(turkeyZone))
	}
}

// 1G'de önceki kapanış noktalara girmez, Baseline olarak ayrıca döner; değişim yine önceki kapanışa göre ölçülür.
func TestOneDay_BaselineReturnedSeparately(t *testing.T) {
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, turkeyZone) }
	now := at(7, 14, 0)
	txs := []database.Transaction{histTx(1, 1, "BUY", 10, 90, 0, at(1, 12, 0), 0)}
	daily := []PricePoint{{T: at(5, 10, 0), Price: 98}, {T: at(6, 10, 0), Price: 100}, {T: at(7, 10, 0), Price: 104}}
	var intraday []PricePoint
	for m := 0; m < 240; m += 5 {
		intraday = append(intraday, PricePoint{T: at(7, 10, 0).Add(time.Duration(m) * time.Minute), Price: 101 + float64(m)/80})
	}
	start, prices := buildOneDayPrices(map[int64]assetSeries{1: {Main: intraday, Daily: daily}}, now)
	prices[1] = append(prices[1], PricePoint{T: now, Price: 105})

	res := BuildValueHistory(ValueHistoryInput{
		Range: "1D", Transactions: txs, Prices: prices, Start: start, End: now, Step: 5 * time.Minute,
		BaselineAt: turkeyDayStart(start).Add(-time.Nanosecond),
	})
	b := res.Baseline
	if b == nil {
		t.Fatal("1G'de baseline dönmeli")
	}
	if !b.T.Equal(start) || b.Value != 1000 || b.Cost != 900 || b.PnL != 100 {
		t.Fatalf("baseline önceki kapanışla (100) değerlenmeli: %+v", *b)
	}
	if len(res.Points) == 0 || !res.Points[0].T.After(start) {
		t.Fatalf("noktalar önceki kapanış noktasıyla başlamamalı: %+v", res.Points)
	}
	if res.Points[0].Value != 1010 {
		t.Fatalf("ilk nokta seansın ilk fiyatı (101) olmalı: %+v", res.Points[0])
	}
	if res.PnLChange != 50 || res.PnLChangePct != 5.56 {
		t.Fatalf("değişim önceki kapanışa göre 50 (%%5,56) olmalı: %v / %v", res.PnLChange, res.PnLChangePct)
	}
	if !res.Start.Equal(start) {
		t.Fatalf("start önceki kapanışın zamanı olmalı: %v", res.Start)
	}
	j, _ := json.Marshal(res)
	var m map[string]any
	_ = json.Unmarshal(j, &m)
	bm, ok := m["baseline"].(map[string]any)
	if !ok || bm["pnl"] != 100.0 {
		t.Fatalf("JSON'da baseline alanı olmalı: %s", j)
	}

	// Diğer aralıklarda baseline yok, JSON'a da yazılmaz
	other := BuildValueHistory(ValueHistoryInput{
		Range: "1M", Transactions: txs, Prices: map[int64][]PricePoint{1: daily},
		Start: at(1, 0, 0), End: now, Step: time.Hour,
	})
	if other.Baseline != nil {
		t.Fatalf("1G dışında baseline olmamalı: %+v", other.Baseline)
	}
	j, _ = json.Marshal(other)
	m = nil
	_ = json.Unmarshal(j, &m)
	if _, ok := m["baseline"]; ok {
		t.Fatalf("1G dışında JSON'da baseline olmamalı: %s", j)
	}
}

// Seans günü ödenen temettü günün değişimine girer; önceki günlerinki önceki kapanışın içindedir.
func TestOneDay_DividendOnSessionDayCountsInChange(t *testing.T) {
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, turkeyZone) }
	now := at(9, 18, 30) // cuma
	txs := []database.Transaction{histTx(1, 1, "BUY", 10, 100, 0, at(1, 12, 0), 0)}
	daily := []PricePoint{{T: at(8, 10, 0), Price: 100}, {T: at(9, 10, 0), Price: 100}}
	var intraday []PricePoint
	for m := 0; m <= 8*60; m += 5 {
		intraday = append(intraday, PricePoint{T: at(9, 10, 0).Add(time.Duration(m) * time.Minute), Price: 100})
	}
	start, prices := buildOneDayPrices(map[int64]assetSeries{1: {Main: intraday, Daily: daily}}, now)
	prices[1] = append(prices[1], PricePoint{T: now, Price: 100})
	divs := []HistoryDividend{{Date: at(8, 3, 0), Net: 7}, {Date: at(9, 3, 0), Net: 25}}

	res := BuildValueHistory(ValueHistoryInput{
		Range: "1D", Transactions: txs, Dividends: divs, Prices: prices, Start: start, End: now,
		Step: 5 * time.Minute, BaselineAt: turkeyDayStart(start).Add(-time.Nanosecond),
	})
	if res.Baseline == nil || res.Baseline.PnL != 7 {
		t.Fatalf("baseline yalnızca önceki günün temettüsünü içermeli: %+v", res.Baseline)
	}
	if res.PnLChange != 25 {
		t.Fatalf("bugün ödenen temettü (25) günün değişimine girmeli: %v", res.PnLChange)
	}
	if last := res.Points[len(res.Points)-1]; last.PnL != 32 {
		t.Fatalf("son pnl tüm temettüleri içermeli: %+v", last)
	}
}

// Seans açılışından önce (ör. sabah döviz) alınan pozisyon önceki kapanışta yoktur; alış fiyatından girer.
func TestOneDay_BuyBeforeOpenNotInBaseline(t *testing.T) {
	at := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, turkeyZone) }
	now := at(9, 18, 30)
	txs := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 0, at(1, 12, 0), 0),
		histTx(2, 2, "BUY", 100, 49.5, 0, at(9, 9, 30), 0),
	}
	stockDaily := []PricePoint{{T: at(8, 10, 0), Price: 100}, {T: at(9, 10, 0), Price: 101}}
	var stock, fx []PricePoint
	for m := 0; m <= 8*60; m += 5 {
		stock = append(stock, PricePoint{T: at(9, 10, 0).Add(time.Duration(m) * time.Minute), Price: 101})
	}
	for m := 0; m <= 16*60; m += 5 {
		fx = append(fx, PricePoint{T: at(9, 2, 0).Add(time.Duration(m) * time.Minute), Price: 49.4})
	}
	fxDaily := []PricePoint{{T: at(8, 2, 0), Price: 49}, {T: at(9, 2, 0), Price: 49.4}}
	start, prices := buildOneDayPrices(map[int64]assetSeries{
		1: {Main: stock, Daily: stockDaily},
		2: {Main: fx, Daily: fxDaily},
	}, now)
	prices[1] = append(prices[1], PricePoint{T: now, Price: 101})
	prices[2] = append(prices[2], PricePoint{T: now, Price: 49.4})

	res := BuildValueHistory(ValueHistoryInput{
		Range: "1D", Transactions: txs, Prices: prices, Start: start, End: now,
		Step: 5 * time.Minute, BaselineAt: turkeyDayStart(start).Add(-time.Nanosecond),
	})
	if res.Baseline == nil || res.Baseline.Cost != 1000 || res.Baseline.Value != 1000 {
		t.Fatalf("sabah alınan döviz önceki kapanışta olmamalı: %+v", res.Baseline)
	}
	// hisse +10, döviz 100 × (49,4 - 49,5) = -10; önceki kapanışla (49) değerlenseydi sahte +40 çıkardı
	if !near(res.PnLChange, 0) {
		t.Fatalf("değişim 10 - 10 = 0 olmalı: %v", res.PnLChange)
	}
}

// Altın serisi güncel fiyata sabitlenir: son nokta güncel fiyat olur, oranlar korunur.
func TestAnchorToPrice(t *testing.T) {
	s := []PricePoint{{T: histNow.Add(-oneDay), Price: 6551.33}, {T: histNow, Price: 6644.78}}
	got := anchorToPrice(s, 6677.55)
	if !near(got[1].Price, 6677.55) {
		t.Fatalf("son nokta güncel fiyat olmalı: %+v", got)
	}
	if !near(got[0].Price, 6551.33*6677.55/6644.78) {
		t.Fatalf("önceki noktalar aynı oranla ölçeklenmeli: %+v", got)
	}
	if s[1].Price != 6644.78 {
		t.Fatal("girdi serisi değişmemeli")
	}
	if out := anchorToPrice(s, 8000); out[1].Price != 6644.78 {
		t.Fatalf("%%5'ten büyük sapmada seri olduğu gibi kalmalı: %+v", out)
	}
	if out := anchorToPrice(nil, 10); out != nil {
		t.Fatal("boş seri boş kalmalı")
	}
}
