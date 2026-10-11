package services

import (
	"sort"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/wac"
)

// Bu dosyadaki hesap I/O yapmaz: işlemleri, temettüleri ve fiyat serilerini alır, grafik noktalarını döner.
// Veri çekme ve önbellek portfolio_history_service.go içinde.

// PricePoint, bir varlığın belli bir andaki fiyatı.
type PricePoint struct {
	T     time.Time
	Price float64
}

// HistoryDividend, geçmiş hesabında kullanılan sade temettü kaydı (stopaj sonrası net tutar).
type HistoryDividend struct {
	Date time.Time
	Net  float64
}

// ValueHistoryPoint, grafikteki tek nokta. pnl = value - cost + o ana kadarki gerçekleşen kâr + temettü.
type ValueHistoryPoint struct {
	T     time.Time `json:"t"`
	Value float64   `json:"value"`
	Cost  float64   `json:"cost"`
	PnL   float64   `json:"pnl"`
}

// ValueHistoryResult, /portfolio/value-history yanıtı.
type ValueHistoryResult struct {
	Range  string              `json:"range"`
	Points []ValueHistoryPoint `json:"points"`
	// Baseline yalnızca 1G'de dolu: önceki kapanıştaki portföy. Grafikte nokta değil referans çizgisi olarak çizilir,
	// pnl_change buna göre ölçülür.
	Baseline     *ValueHistoryPoint `json:"baseline,omitempty"`
	PnLChange    float64            `json:"pnl_change"`
	PnLChangePct float64            `json:"pnl_change_pct"`
	Start        time.Time          `json:"start"`
	End          time.Time          `json:"end"`
}

// ValueHistoryInput, BuildValueHistory'nin girdisi.
type ValueHistoryInput struct {
	Range        string
	Transactions []database.Transaction
	Dividends    []HistoryDividend
	// Prices, varlık ID'sine göre eskiden yeniye sıralı fiyatlar.
	Prices map[int64][]PricePoint
	// Start, istenen aralığın başı; portföy daha yeniyse ilk işlem anına çekilir.
	Start time.Time
	// End, son nokta (normalde şimdi).
	End time.Time
	// Step, zaman çizelgesinin aralığı; aynı dilime düşen fiyat zamanlarından en sonuncusu kalır. 0 ise gruplanmaz.
	Step time.Duration
	// BaselineAt doluysa (1G) ilk nokta grafiğe konmaz, Baseline olarak ayrıca döner. Lot, maliyet, gerçekleşen kâr
	// ve temettü bu andaki haliyle, fiyatlar Start anındaki haliyle (önceki kapanış) alınır. Seans günü ödenen
	// temettü ve seans öncesi işlemler böylece günün değişimine girer.
	BaselineAt time.Time
}

// lotState, bir varlığın belli bir işlemden sonraki lotu ve ağırlıklı ortalama maliyeti.
type lotState struct {
	T       time.Time
	Qty     float64
	AvgCost float64
}

// timedAmount, birikimli toplamı tutulan olaylar (gerçekleşen kâr, temettü).
type timedAmount struct {
	T   time.Time
	Cum float64
}

// BuildValueHistory, kullanıcının gerçek portföy geçmişini hesaplar.
//
// Her t anında: lot = t'ye kadarki işlemlerin net lotu, maliyet = WAC × lot,
// değer = Σ lot × t anındaki (ya da öncesindeki son) fiyat,
// pnl = değer - maliyet + t'ye kadarki gerçekleşen kâr/zarar + t'ye kadarki net temettü.
//
// Portföy aralıktan daha gençse ilk nokta ilk işlem anıdır ve o noktada varlıklar ödenen
// maliyetle değerlenir (pnl = 0). Böylece pnl_change bugünkü toplam kâra eşit olur.
// Değilse ilk nokta aralık başıdır ve başlangıçtaki ya da hemen önceki son fiyatla değerlenir;
// BaselineAt verilmişse (1G) bu nokta Points'e değil Baseline'a yazılır.
// İşlem fiyatları da fiyat gözlemi sayılır (bkz. withTradePrices).
// Elde tutulan bir varlığın o ana kadar hiç fiyatı yoksa o nokta atlanır.
func BuildValueHistory(in ValueHistoryInput) ValueHistoryResult {
	res := ValueHistoryResult{
		Range:  in.Range,
		Points: []ValueHistoryPoint{},
		Start:  outTime(in.Start),
		End:    outTime(in.End),
	}

	txs := make([]database.Transaction, 0, len(in.Transactions))
	for _, tx := range in.Transactions {
		if tx.DeletedAt.Valid || tx.TransactionDate.After(in.End) {
			continue
		}
		txs = append(txs, tx)
	}
	if len(txs) == 0 {
		return res
	}
	sort.SliceStable(txs, func(i, j int) bool {
		if txs[i].TransactionDate.Equal(txs[j].TransactionDate) {
			return txs[i].ID < txs[j].ID
		}
		return txs[i].TransactionDate.Before(txs[j].TransactionDate)
	})

	// Varlık bazında her işlemden sonraki lot ve maliyet; WAC hesabı wac paketinden geliyor.
	byAsset := make(map[int64][]database.Transaction)
	for _, tx := range txs {
		byAsset[tx.AssetID] = append(byAsset[tx.AssetID], tx)
	}
	assetIDs := make([]int64, 0, len(byAsset))
	states := make(map[int64][]lotState, len(byAsset))
	for id, list := range byAsset {
		assetIDs = append(assetIDs, id)
		st := make([]lotState, len(list))
		for i := range list {
			qty, avg := wac.HoldingAndCost(list[:i+1])
			st[i] = lotState{T: list[i].TransactionDate, Qty: qty, AvgCost: avg}
		}
		states[id] = st
	}
	// Toplamların sırası hep aynı olsun diye ID sırasıyla geziyoruz.
	sort.Slice(assetIDs, func(i, j int) bool { return assetIDs[i] < assetIDs[j] })

	// İşlem fiyatı da o anda gözlenmiş bir fiyat sayılır. Böylece işlemden sonra varlık, işlemden önceki
	// eski bir mumla değil işlem fiyatıyla değerlenir; aralıkta alınan pozisyon maliyetiyle girer, sahte kâr oluşmaz.
	series := make(map[int64][]PricePoint, len(assetIDs))
	for _, id := range assetIDs {
		series[id] = withTradePrices(in.Prices[id], byAsset[id])
	}

	// Gerçekleşen kâr/zarar: özetle aynı kaynak, satışlarda kayıtlı realized_pnl.
	var realized []timedAmount
	cum := 0.0
	for _, tx := range txs {
		if tx.Type != "SELL" {
			continue
		}
		cum += parseFloatSafe(tx.RealizedPnl)
		realized = append(realized, timedAmount{T: tx.TransactionDate, Cum: cum})
	}

	divs := make([]HistoryDividend, len(in.Dividends))
	copy(divs, in.Dividends)
	sort.SliceStable(divs, func(i, j int) bool { return divs[i].Date.Before(divs[j].Date) })
	dividends := make([]timedAmount, 0, len(divs))
	cum = 0
	for _, d := range divs {
		cum += d.Net
		dividends = append(dividends, timedAmount{T: d.Date, Cum: cum})
	}

	firstTx := txs[0].TransactionDate
	start := in.Start
	inception := !start.After(firstTx)
	if inception {
		start = firstTx
	}
	end := in.End

	type rawPoint struct {
		t                time.Time
		value, cost, pnl float64
	}
	// evalAt, holdT anındaki lot/maliyet/kâr/temettüyü priceT anındaki fiyatlarla değerler.
	evalAt := func(holdT, priceT time.Time, atInception bool) (rawPoint, bool) {
		var value, cost float64
		for _, id := range assetIDs {
			st := states[id]
			i := lastAtOrBefore(len(st), func(k int) time.Time { return st[k].T }, holdT)
			if i < 0 || st[i].Qty <= lotTolerance {
				continue
			}
			c := st[i].Qty * st[i].AvgCost
			cost += c
			if atInception {
				// Portföyün doğduğu an: ödenen bedelle değerliyoruz, kâr sıfırdan başlıyor.
				value += c
				continue
			}
			price, ok := priceAt(series[id], priceT)
			if !ok {
				return rawPoint{}, false
			}
			value += st[i].Qty * price
		}
		pnl := value - cost + cumAt(realized, holdT) + cumAt(dividends, holdT)
		return rawPoint{t: priceT, value: value, cost: cost, pnl: pnl}, true
	}

	times := buildTimeline(in.Prices, start, end, in.Step)
	useBaseline := !inception && !in.BaselineAt.IsZero() && !in.BaselineAt.After(start)
	var baseline *rawPoint
	raw := make([]rawPoint, 0, len(times))
	for i, t := range times {
		if i == 0 && useBaseline {
			// Önceki kapanış: grafiğe nokta olarak girmez, referans olarak ayrıca döner.
			if p, ok := evalAt(in.BaselineAt, t, false); ok {
				baseline = &p
			}
			continue
		}
		if p, ok := evalAt(t, t, inception && t.Equal(start)); ok {
			raw = append(raw, p)
		}
	}
	if baseline != nil {
		res.Baseline = &ValueHistoryPoint{T: outTime(baseline.t), Value: round2(baseline.value), Cost: round2(baseline.cost), PnL: round2(baseline.pnl)}
	}
	if len(raw) == 0 {
		res.Start = outTime(start)
		return res
	}

	res.Points = make([]ValueHistoryPoint, len(raw))
	for i, p := range raw {
		res.Points[i] = ValueHistoryPoint{T: outTime(p.t), Value: round2(p.value), Cost: round2(p.cost), PnL: round2(p.pnl)}
	}
	// Değişim referanstan (varsa önceki kapanış, yoksa ilk nokta) son noktaya.
	ref, last := raw[0], raw[len(raw)-1]
	if baseline != nil {
		ref = *baseline
	}
	change := last.pnl - ref.pnl
	res.PnLChange = round2(change)
	if last.cost > 0 {
		res.PnLChangePct = round2(change / last.cost * 100)
	}
	res.Start = outTime(ref.t)
	res.End = outTime(last.t)
	return res
}

// buildTimeline, başlangıç + fiyat serilerinin (start, end) arasındaki zamanları + bitişten oluşan sıralı listeyi döner.
// Aynı dilime düşen zamanlardan en sonuncusu kalır; bitişin dilimi bitişe bırakılır.
func buildTimeline(prices map[int64][]PricePoint, start, end time.Time, step time.Duration) []time.Time {
	key := func(t time.Time) int64 {
		if step <= 0 {
			return t.UnixNano()
		}
		return t.Truncate(step).UnixNano()
	}
	endKey := key(end)
	buckets := make(map[int64]time.Time)
	for _, series := range prices {
		for _, p := range series {
			if !p.T.After(start) || !p.T.Before(end) {
				continue
			}
			k := key(p.T)
			if k == endKey {
				continue
			}
			if cur, ok := buckets[k]; !ok || p.T.After(cur) {
				buckets[k] = p.T
			}
		}
	}
	mid := make([]time.Time, 0, len(buckets))
	for _, t := range buckets {
		mid = append(mid, t)
	}
	sort.Slice(mid, func(i, j int) bool { return mid[i].Before(mid[j]) })

	times := make([]time.Time, 0, len(mid)+2)
	times = append(times, start)
	times = append(times, mid...)
	if end.After(start) {
		times = append(times, end)
	}
	return times
}

// withTradePrices, piyasa serisine varlığın işlem fiyatlarını ekleyip zamana göre sıralı yeni bir seri döner.
// Aynı anda piyasa fiyatı da varsa işlem fiyatı sonra gelir.
func withTradePrices(market []PricePoint, txs []database.Transaction) []PricePoint {
	out := make([]PricePoint, 0, len(market)+len(txs))
	out = append(out, market...)
	for _, tx := range txs {
		if p := parseFloatSafe(tx.Price); p > 0 {
			out = append(out, PricePoint{T: tx.TransactionDate, Price: p})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].T.Before(out[j].T) })
	return out
}

// lastAtOrBefore, zamanı t'den sonra olmayan son elemanın indeksini döner; yoksa -1.
func lastAtOrBefore(n int, at func(int) time.Time, t time.Time) int {
	return sort.Search(n, func(i int) bool { return at(i).After(t) }) - 1
}

// priceAt, t anındaki ya da öncesindeki son fiyatı döner.
func priceAt(series []PricePoint, t time.Time) (float64, bool) {
	i := lastAtOrBefore(len(series), func(k int) time.Time { return series[k].T }, t)
	if i < 0 {
		return 0, false
	}
	return series[i].Price, true
}

// cumAt, t anına kadarki birikimli toplamı döner.
func cumAt(events []timedAmount, t time.Time) float64 {
	i := lastAtOrBefore(len(events), func(k int) time.Time { return events[k].T }, t)
	if i < 0 {
		return 0
	}
	return events[i].Cum
}

// outTime, yanıttaki zamanları saniyeye yuvarlanmış UTC olarak verir.
func outTime(t time.Time) time.Time {
	return t.UTC().Truncate(time.Second)
}
