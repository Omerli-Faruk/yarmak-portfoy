package services

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"yarmak/internal/wac"
)

const (
	valueHistoryCacheTTL   = 5 * time.Minute
	valueHistoryTimeout    = 10 * time.Second
	valueHistoryFetchWait  = 8 * time.Second
	valueHistoryFetchLimit = 4
	oneDay                 = 24 * time.Hour
	// 1G'de gösterilen seans uzun bir tatilden önceki gün olabilir; bu kadar geriye bakıyoruz.
	oneDayLookback = 10 * oneDay
	// BIST seansının açılışı (İstanbul saati).
	sessionOpenHour = 10
)

// valueHistorySteps, her aralık için zaman çizelgesinin dilimi.
var valueHistorySteps = map[string]time.Duration{
	"1D":  5 * time.Minute,
	"1W":  30 * time.Minute,
	"1M":  time.Hour,
	"3M":  oneDay,
	"6M":  oneDay,
	"YTD": oneDay,
	"1Y":  oneDay,
	"3Y":  7 * oneDay,
	"5Y":  7 * oneDay,
}

// Türkiye'de yaz saati yok, sabit +03:00 yeterli.
var turkeyZone = time.FixedZone("TRT", 3*3600)

// NormalizeValueHistoryRange, range parametresini doğrular. Boşsa 1Y döner.
func NormalizeValueHistoryRange(raw string) (string, bool) {
	r := strings.ToUpper(strings.TrimSpace(raw))
	if r == "" {
		return "1Y", true
	}
	_, ok := valueHistorySteps[r]
	return r, ok
}

// valueHistoryRangeStart, aralığın takvimdeki başlangıcı. 1D'nin asıl başlangıcı veri gelince
// oneDayWindow ile seans açılışına çekilir.
func valueHistoryRangeStart(rng string, now time.Time) time.Time {
	switch rng {
	case "1D":
		return now.Add(-oneDay)
	case "1W":
		return now.AddDate(0, 0, -7)
	case "1M":
		return now.AddDate(0, -1, 0)
	case "3M":
		return now.AddDate(0, -3, 0)
	case "6M":
		return now.AddDate(0, -6, 0)
	case "YTD":
		n := now.In(turkeyZone)
		return time.Date(n.Year(), 1, 1, 0, 0, 0, 0, turkeyZone)
	case "3Y":
		return now.AddDate(-3, 0, 0)
	case "5Y":
		return now.AddDate(-5, 0, 0)
	default:
		return now.AddDate(-1, 0, 0)
	}
}

// yahooPlan, Yahoo'dan istenecek aralık ve veri sıklığı.
type yahooPlan struct {
	Range    string
	Interval string
}

var (
	// 1G: seans içi 5 dakikalık veri + önceki kapanış için günlük veri.
	oneDayIntradayPlan = yahooPlan{"1d", "5m"}
	oneDayDailyPlan    = yahooPlan{"1mo", "1d"}
)

// yahooPlanForSpan, gereken süreyi (aralık başı ya da ilk işlemden bugüne) payıyla kapsayan en kısa Yahoo aralığını seçer.
// Pay sayesinde başlangıçtan önceki son fiyat da gelir; ilk nokta aralığın içindeki ilk mum değil,
// başlangıçtaki (ya da hemen önceki) fiyattır. Portföy gençse daha kısa ve sık veri çekilir.
func yahooPlanForSpan(span time.Duration) yahooPlan {
	switch {
	case span <= 21*oneDay:
		return yahooPlan{"1mo", "30m"}
	case span <= 80*oneDay:
		return yahooPlan{"3mo", "1h"}
	case span <= 170*oneDay:
		return yahooPlan{"6mo", "1h"}
	case span <= 350*oneDay:
		return yahooPlan{"1y", "1d"}
	case span <= 715*oneDay:
		return yahooPlan{"2y", "1d"}
	case span <= 1810*oneDay:
		return yahooPlan{"5y", "1wk"}
	default:
		return yahooPlan{"10y", "1wk"}
	}
}

// valueHistoryCache, hesaplanan sonucu kullanıcı+aralık bazında 5 dakika tutar.
// İşlem ya da temettü değişirse parmak izi tutmaz ve yeniden hesaplanır.
type valueHistoryCache struct {
	mu      sync.Mutex
	entries map[string]valueHistoryCacheEntry
}

type valueHistoryCacheEntry struct {
	fingerprint uint64
	expires     time.Time
	result      ValueHistoryResult
}

func (c *valueHistoryCache) get(key string, fp uint64, now time.Time) (ValueHistoryResult, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok || e.fingerprint != fp || now.After(e.expires) {
		return ValueHistoryResult{}, false
	}
	return e.result, true
}

func (c *valueHistoryCache) put(key string, fp uint64, now time.Time, res ValueHistoryResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = make(map[string]valueHistoryCacheEntry)
	}
	// Harita büyümesin diye süresi geçenleri ara ara temizliyoruz.
	if len(c.entries) >= 256 {
		for k, e := range c.entries {
			if now.After(e.expires) {
				delete(c.entries, k)
			}
		}
	}
	c.entries[key] = valueHistoryCacheEntry{fingerprint: fp, expires: now.Add(valueHistoryCacheTTL), result: res}
}

// valueHistoryFingerprint, işlem ve temettülerden kısa bir özet çıkarır; önbellek bununla tazelenir.
func valueHistoryFingerprint(txs []database.Transaction, divs []HistoryDividend) uint64 {
	h := fnv.New64a()
	for _, tx := range txs {
		fmt.Fprintf(h, "t%d|%d|%s|%s|%s|%s|%s|%d;", tx.ID, tx.AssetID, tx.Type, tx.Amount, tx.Price,
			tx.Commission, tx.RealizedPnl, tx.TransactionDate.UnixNano())
	}
	for _, d := range divs {
		fmt.Fprintf(h, "d%d|%g;", d.Date.UnixNano(), d.Net)
	}
	return h.Sum64()
}

// assetSeries, bir varlığın çekilen fiyatları. Daily yalnızca 1G'de dolu: önceki kapanışı bulmak için günlük seri.
type assetSeries struct {
	Main  []PricePoint
	Daily []PricePoint
}

// oneDayWindow, 1G grafiğinin seans gününü ve başlangıcını verir. Seans günü, verilen son fiyatın
// İstanbul tarihidir; hafta sonuna düşerse cumaya çekilir. Başlangıç o günün 10:00'ı; henüz 10:00 olmadıysa gün başı.
func oneDayWindow(latest, now time.Time) (dayStart, start time.Time) {
	if latest.IsZero() || latest.After(now) {
		latest = now
	}
	d := latest.In(turkeyZone)
	dayStart = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, turkeyZone)
	switch dayStart.Weekday() {
	case time.Saturday:
		dayStart = dayStart.AddDate(0, 0, -1)
	case time.Sunday:
		dayStart = dayStart.AddDate(0, 0, -2)
	}
	start = dayStart.Add(sessionOpenHour * time.Hour)
	if !start.Before(now) {
		start = dayStart
	}
	return dayStart, start
}

// previousClose, seans gününden önceki son fiyatı (önceki kapanış) döner.
func previousClose(daily []PricePoint, dayStart time.Time) (float64, bool) {
	i := lastAtOrBefore(len(daily), func(k int) time.Time { return daily[k].T }, dayStart.Add(-time.Nanosecond))
	if i < 0 {
		return 0, false
	}
	return daily[i].Price, true
}

// withBaseline, 1G serisini kurar: başlangıçta önceki kapanış, ardından seans içi fiyatlar.
// Seans günü açılıştan önce oluşmuş son fiyat (gece işlem gören altın/döviz, gün tarihli fon fiyatı)
// kaybolmasın diye açılıştan bir saniye sonraya taşınır; böylece önceki kapanıştan açılışa olan fark da sayılır.
func withBaseline(points []PricePoint, dayStart, start time.Time, base float64) []PricePoint {
	out := make([]PricePoint, 0, len(points)+2)
	out = append(out, PricePoint{T: start, Price: base})
	after := start
	var pre *PricePoint
	for i := range points {
		p := points[i]
		if !p.T.Before(dayStart) && !p.T.After(start) {
			pre = &points[i]
		}
	}
	if pre != nil {
		after = start.Add(time.Second)
		out = append(out, PricePoint{T: after, Price: pre.Price})
	}
	for _, p := range points {
		if p.T.After(after) {
			out = append(out, p)
		}
	}
	return out
}

// buildOneDayPrices, 1G için seans başlangıcını bulur ve her varlığın serisini önceki kapanışla başlatır.
// Önceki kapanış: seans gününden önceki son günlük kapanış (FON için o günden önceki son fiyat).
// Önceki kapanışı bulunamayan varlığın serisi olduğu gibi kalır.
func buildOneDayPrices(series map[int64]assetSeries, now time.Time) (time.Time, map[int64][]PricePoint) {
	// Seans gününü açılıştan (10:00) sonraki son fiyattan buluyoruz. Gece de işlem gören döviz/altının
	// gece yarısını geçen mumları (ör. cumartesi 00:30) seans gününü kaydırmasın.
	// Hiç yoksa (yalnız fon gibi) en son fiyatın günü alınır.
	var latestOpen, latestAny time.Time
	for _, s := range series {
		for _, p := range s.Main {
			if p.T.After(now) {
				continue
			}
			if p.T.After(latestAny) {
				latestAny = p.T
			}
			if p.T.In(turkeyZone).Hour() >= sessionOpenHour && p.T.After(latestOpen) {
				latestOpen = p.T
			}
		}
	}
	latest := latestOpen
	if latest.IsZero() {
		latest = latestAny
	}
	dayStart, start := oneDayWindow(latest, now)
	out := make(map[int64][]PricePoint, len(series))
	for id, s := range series {
		daily := s.Daily
		if len(daily) == 0 {
			daily = s.Main
		}
		if base, ok := previousClose(daily, dayStart); ok {
			out[id] = withBaseline(s.Main, dayStart, start, base)
		} else {
			out[id] = s.Main
		}
	}
	return start, out
}

// turkeyDayStart, t'nin İstanbul tarihindeki gün başı.
func turkeyDayStart(t time.Time) time.Time {
	d := t.In(turkeyZone)
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, turkeyZone)
}

// anchorToPrice, seriyi son noktası price olacak şekilde aynı oranla ölçekler. Oran %5'ten fazla saparsa
// kaynaklardan biri hatalı demektir; seri olduğu gibi kalır.
func anchorToPrice(series []PricePoint, price float64) []PricePoint {
	if len(series) == 0 || price <= 0 {
		return series
	}
	last := series[len(series)-1].Price
	if last <= 0 {
		return series
	}
	ratio := price / last
	if ratio <= 0.95 || ratio >= 1.05 {
		return series
	}
	out := make([]PricePoint, len(series))
	for i, p := range series {
		out[i] = PricePoint{T: p.T, Price: p.Price * ratio}
	}
	return out
}

type assetSeriesResult struct {
	assetID int64
	series  assetSeries
	err     error
}

// GetValueHistory, kullanıcının gerçek portföy geçmişini döner (bkz. BuildValueHistory).
// Fiyatlar uygulamanın geri kalanıyla aynı kaynaktan gelir: FON için veritabanı, diğerleri için Yahoo
// (olmazsa veritabanı). Son nokta, özetteki gibi varlıkların veritabanındaki güncel fiyatıyla hesaplanır.
func (s *PortfolioService) GetValueHistory(ctx context.Context, userID int64, rng string) (ValueHistoryResult, error) {
	step, ok := valueHistorySteps[rng]
	if !ok {
		return ValueHistoryResult{}, fmt.Errorf("geçersiz aralık: %s", rng)
	}
	ctx, cancel := context.WithTimeout(ctx, valueHistoryTimeout)
	defer cancel()
	now := time.Now()
	rangeStart := valueHistoryRangeStart(rng, now)

	txs, err := s.DB.GetAllUserTransactions(ctx, userID)
	if err != nil {
		return ValueHistoryResult{}, fmt.Errorf("işlemler alınamadı: %w", err)
	}
	divRows, err := s.DB.GetUserDividends(ctx, userID)
	if err != nil {
		return ValueHistoryResult{}, fmt.Errorf("temettüler alınamadı: %w", err)
	}
	dividends := make([]HistoryDividend, 0, len(divRows))
	for _, d := range divRows {
		dividends = append(dividends, HistoryDividend{Date: d.PaymentDate, Net: parseFloatSafe(d.NetAmount)})
	}

	if len(txs) == 0 {
		return BuildValueHistory(ValueHistoryInput{Range: rng, Start: rangeStart, End: now, Step: step}), nil
	}

	cacheKey := fmt.Sprintf("%d|%s", userID, rng)
	fp := valueHistoryFingerprint(txs, dividends)
	if cached, ok := s.historyCache.get(cacheKey, fp, now); ok {
		return cached, nil
	}

	firstTx := txs[0].TransactionDate
	byAsset := make(map[int64][]database.Transaction)
	for _, tx := range txs {
		if tx.TransactionDate.Before(firstTx) {
			firstTx = tx.TransactionDate
		}
		byAsset[tx.AssetID] = append(byAsset[tx.AssetID], tx)
	}
	effStart := rangeStart
	if firstTx.After(effStart) {
		effStart = firstTx
	}

	// 1G'de seans günü birkaç gün geride olabilir (hafta sonu, tatil); o yüzden daha geriden bakıyoruz.
	neededFrom := effStart
	plan := yahooPlanForSpan(now.Sub(effStart))
	if rng == "1D" {
		neededFrom = now.Add(-oneDayLookback)
		plan = oneDayIntradayPlan
	}
	dbCutoff := neededFrom.Add(-15 * oneDay)

	// Sadece aralıkta elde tutulmuş varlıkların fiyatı gerekiyor; çoktan satılmışları atlıyoruz.
	type assetInfo struct {
		asset    database.Asset
		current  float64
		hasInfo  bool
		hasPrice bool // current veritabanındaki güncel fiyat (ortalama maliyet yedeği değil)
	}
	infos := make(map[int64]*assetInfo)
	for id, list := range byAsset {
		needed := false
		var before []database.Transaction
		for _, tx := range list {
			if tx.TransactionDate.After(neededFrom) {
				if !tx.TransactionDate.After(now) {
					needed = true
				}
			} else {
				before = append(before, tx)
			}
		}
		if !needed {
			if qty, _ := wac.HoldingAndCost(before); qty > lotTolerance {
				needed = true
			}
		}
		if !needed {
			continue
		}

		// Özetle aynı mantık: güncel fiyat yoksa ortalama maliyet kullanılır.
		var upToNow []database.Transaction
		for _, tx := range list {
			if !tx.TransactionDate.After(now) {
				upToNow = append(upToNow, tx)
			}
		}
		_, avgCost := wac.HoldingAndCost(upToNow)
		info := &assetInfo{current: avgCost}
		asset, aErr := s.DB.GetAssetByID(ctx, id)
		if aErr == nil {
			info.asset = asset
			info.hasInfo = true
			if p := parseFloatSafe(asset.CurrentPrice); p > 0 {
				info.current = p
				info.hasPrice = true
			}
		} else {
			slog.Warn("Portföy geçmişi: varlık okunamadı", "asset_id", id, "error", aErr)
		}
		infos[id] = info
	}

	// Her varlığın geçmişi bir kez, en fazla 4'ü aynı anda çekilir. Süre dolarsa bekleyenler bırakılır.
	fetchCtx, cancelFetch := context.WithTimeout(ctx, valueHistoryFetchWait)
	defer cancelFetch()
	results := make(chan assetSeriesResult, len(infos))
	sem := make(chan struct{}, valueHistoryFetchLimit)
	pending := 0
	for id, info := range infos {
		if !info.hasInfo {
			continue
		}
		pending++
		go func(id int64, asset database.Asset) {
			select {
			case sem <- struct{}{}:
			case <-fetchCtx.Done():
				results <- assetSeriesResult{assetID: id, err: fetchCtx.Err()}
				return
			}
			defer func() { <-sem }()
			series, err := s.fetchAssetSeries(fetchCtx, asset, plan, dbCutoff, rng == "1D")
			results <- assetSeriesResult{assetID: id, series: series, err: err}
		}(id, info.asset)
	}

	fetched := make(map[int64]assetSeries, len(infos))
collect:
	for pending > 0 {
		select {
		case r := <-results:
			pending--
			if r.err == nil && len(r.series.Main) > 0 {
				fetched[r.assetID] = r.series
			} else {
				slog.Warn("Portföy geçmişi: varlık fiyat geçmişi alınamadı, güncel fiyatla dolduruluyor",
					"asset_id", r.assetID, "error", r.err)
			}
		case <-fetchCtx.Done():
			break collect
		}
	}

	// Altın geçmişi vadeli ons × dolar kurundan türetilip çekildiği andaki serbest piyasa fiyatına ölçekleniyor.
	// Son nokta ise veritabanındaki güncel fiyat; iki anlık görüntü farklıysa grafiğin sonunda sahte bir sıçrama
	// oluşuyordu. Seriyi son noktası güncel fiyata denk gelecek şekilde yeniden ölçekliyoruz.
	for id, sr := range fetched {
		info := infos[id]
		if info == nil || !info.hasPrice || !scraper.IsGramGoldSymbol(info.asset.Symbol) {
			continue
		}
		sr.Main = anchorToPrice(sr.Main, info.current)
		sr.Daily = anchorToPrice(sr.Daily, info.current)
		fetched[id] = sr
	}

	var prices map[int64][]PricePoint
	start := rangeStart
	var baselineAt time.Time
	if rng == "1D" {
		start, prices = buildOneDayPrices(fetched, now)
		// Önceki kapanıştaki portföy: seans gününden hemen önceki an
		baselineAt = turkeyDayStart(start).Add(-time.Nanosecond)
	} else {
		prices = make(map[int64][]PricePoint, len(fetched))
		for id, sr := range fetched {
			prices[id] = sr.Main
		}
	}

	var missing []string
	for id, info := range infos {
		series, ok := prices[id]
		if !ok {
			// Geçmiş yoksa güncel fiyatı en baştan beri geçerliymiş gibi kullanıyoruz.
			name := info.asset.Symbol
			if name == "" {
				name = fmt.Sprintf("#%d", id)
			}
			missing = append(missing, name)
			series = []PricePoint{{T: time.Time{}, Price: info.current}}
		}
		if info.current > 0 {
			series = append(series, PricePoint{T: now, Price: info.current})
		}
		prices[id] = series
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		slog.Warn("Portföy geçmişi bazı varlıklarda düz güncel fiyatla çizildi", "user_id", userID, "range", rng, "symbols", missing)
	}

	res := BuildValueHistory(ValueHistoryInput{
		Range:        rng,
		Transactions: txs,
		Dividends:    dividends,
		Prices:       prices,
		Start:        start,
		End:          now,
		Step:         step,
		BaselineAt:   baselineAt,
	})
	s.historyCache.put(cacheKey, fp, now, res)
	return res, nil
}

// fetchAssetSeries, varlığın fiyat geçmişini HandlerGetAssetPriceHistory ile aynı kaynaklardan çeker:
// FON dışındakiler önce Yahoo (altın için scraper.FetchGoldHistoryInterval'a yönlenir), olmazsa veritabanı.
// withDaily ise (1G) önceki kapanış için Yahoo'dan ayrıca günlük kapanışlar çekilir; veritabanı serisi zaten günlüktür.
func (s *PortfolioService) fetchAssetSeries(ctx context.Context, asset database.Asset, plan yahooPlan, dbCutoff time.Time, withDaily bool) (assetSeries, error) {
	if asset.AssetType != "FON" {
		pts, err := fetchYahooSeries(asset.Symbol, plan)
		if err == nil {
			res := assetSeries{Main: pts}
			if withDaily {
				daily, dErr := fetchYahooSeries(asset.Symbol, oneDayDailyPlan)
				if dErr != nil {
					slog.Debug("Portföy geçmişi: günlük kapanışlar alınamadı", "symbol", asset.Symbol, "error", dErr)
				}
				res.Daily = daily
			}
			return res, nil
		}
		slog.Debug("Portföy geçmişi: Yahoo verisi yok, veritabanına bakılıyor", "symbol", asset.Symbol, "error", err)
	}

	rows, err := s.DB.GetAssetPriceHistoryRange(ctx, database.GetAssetPriceHistoryRangeParams{
		AssetID:    asset.ID,
		RecordedAt: dbCutoff,
	})
	if err != nil {
		return assetSeries{}, err
	}
	pts := make([]PricePoint, 0, len(rows))
	for _, r := range rows {
		if p := parseFloatSafe(r.Price); p > 0 {
			pts = append(pts, PricePoint{T: r.RecordedAt, Price: p})
		}
	}
	if len(pts) == 0 {
		return assetSeries{}, errors.New("fiyat geçmişi bulunamadı")
	}
	sortPricePoints(pts)
	return assetSeries{Main: pts}, nil
}

// fetchYahooSeries, Yahoo geçmişini sıralı PricePoint listesine çevirir. Tek noktalık sonuç (Bigpara yedeği) geçmiş sayılmaz.
func fetchYahooSeries(symbol string, plan yahooPlan) ([]PricePoint, error) {
	_, hist, err := scraper.FetchBISTHistoryInterval(symbol, plan.Range, plan.Interval)
	if err != nil {
		return nil, err
	}
	pts := make([]PricePoint, 0, len(hist))
	for _, h := range hist {
		if h.Price > 0 {
			pts = append(pts, PricePoint{T: h.Date, Price: h.Price})
		}
	}
	if len(pts) < 2 {
		return nil, errors.New("yeterli geçmiş yok")
	}
	sortPricePoints(pts)
	return pts, nil
}

func sortPricePoints(pts []PricePoint) {
	sort.SliceStable(pts, func(i, j int) bool { return pts[i].T.Before(pts[j].T) })
}
