// loadtest, API'yi çok sayıda eşzamanlı kullanıcıyla dener ve dışarıya (Yahoo'ya) kaç istek gittiğini ölçer.
// Gerçek Yahoo'ya hiç gidilmez: program kendi sahte Yahoo sunucusunu açar, API bu sunucuya yönlendirilir.
//
// Kullanım (iki terminal):
//
//  1. go run ./cmd/loadtest -users 300 -duration 60s -funds 16,56,63
//     Program sahte Yahoo'yu açar ve API'nin ayağa kalkmasını 60 sn bekler.
//  2. API'yi sahte Yahoo'ya yönlendirerek başlatın:
//     YAHOO_BASE_URL=http://127.0.0.1:9099 TRUSTED_PROXIES=127.0.0.1/32 PORT=8099 DB_URL=... go run .
//
// Ban senaryosu için 1. adıma -block-after 50 ekleyin: sahte Yahoo 50. istekten sonra hep 429 döner.
// -funds: geçmişi olan fon ID'leri; geçmişi olmayan bir fon gerçek TEFAS'a istek attırır.
//
// TRUSTED_PROXIES sayesinde her sanal kullanıcı X-Real-IP ile ayrı bir IP'den geliyormuş gibi sayılır;
// yoksa API'nin IP başına dakikada 1000 istek sınırı tek bilgisayardan yapılan testi durdurur.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/http/cookiejar"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ---------- Sahte Yahoo ----------

type fakeYahoo struct {
	latency    time.Duration
	blockAfter int64 // bu kadar istekten sonra hep 429 döner (0: hiç)

	total       atomic.Int64
	blocked     atomic.Int64
	concurrent  atomic.Int64
	maxConc     atomic.Int64
	mu          sync.Mutex
	perSecond   map[int64]int
	afterBlock  atomic.Int64 // engel başladıktan sonra gelen istek sayısı
	blockedFrom atomic.Int64 // engelin başladığı an (unix nano)
}

func newFakeYahoo(latency time.Duration, blockAfter int64) *fakeYahoo {
	return &fakeYahoo{latency: latency, blockAfter: blockAfter, perSecond: make(map[int64]int)}
}

func pointsFor(interval string) int {
	switch interval {
	case "5m":
		return 80
	case "30m":
		return 70
	case "1h", "60m":
		return 500
	case "1d":
		return 250
	case "1wk":
		return 160
	default:
		return 60
	}
}

func (f *fakeYahoo) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	n := f.total.Add(1)
	f.mu.Lock()
	f.perSecond[time.Now().Unix()]++
	f.mu.Unlock()
	c := f.concurrent.Add(1)
	defer f.concurrent.Add(-1)
	for {
		m := f.maxConc.Load()
		if c <= m || f.maxConc.CompareAndSwap(m, c) {
			break
		}
	}

	if f.blockAfter > 0 && n > f.blockAfter {
		if f.blockedFrom.Load() == 0 {
			f.blockedFrom.Store(time.Now().UnixNano())
		} else {
			f.afterBlock.Add(1)
		}
		f.blocked.Add(1)
		http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
		return
	}

	time.Sleep(f.latency)
	if !strings.HasPrefix(r.URL.Path, "/v8/finance/chart/") {
		http.NotFound(w, r)
		return
	}
	cnt := pointsFor(r.URL.Query().Get("interval"))
	ts := make([]int64, cnt)
	closes := make([]float64, cnt)
	start := time.Now().Add(-time.Duration(cnt) * time.Hour).Unix()
	price := 100.0
	for i := range cnt {
		ts[i] = start + int64(i)*3600
		price *= 1 + (rand.Float64()-0.5)/50
		closes[i] = price
	}
	resp := map[string]any{"chart": map[string]any{"result": []any{map[string]any{
		"meta":       map[string]any{"regularMarketPrice": price},
		"timestamp":  ts,
		"indicators": map[string]any{"quote": []any{map[string]any{"close": closes}}},
	}}}}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// ---------- Yük üretici ----------

type sample struct {
	action string
	status int
	dur    time.Duration
	err    string
}

type stats struct {
	mu      sync.Mutex
	samples []sample
}

func (s *stats) add(x sample) {
	s.mu.Lock()
	s.samples = append(s.samples, x)
	s.mu.Unlock()
}

type asset struct {
	ID        int64
	Symbol    string
	AssetType string
}

var stockRanges = []string{"1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"}
var portfolioRanges = []string{"1D", "1W", "1M", "1Y"}

func main() {
	api := flag.String("api", "http://127.0.0.1:8099/v1", "API adresi")
	fakeAddr := flag.String("fake", "127.0.0.1:9099", "sahte Yahoo'nun dinleyeceği adres")
	fakeOnly := flag.Bool("fake-only", false, "yalnızca sahte Yahoo'yu çalıştır")
	users := flag.Int("users", 300, "eşzamanlı sanal kullanıcı")
	duration := flag.Duration("duration", 60*time.Second, "test süresi")
	latency := flag.Duration("yahoo-latency", 200*time.Millisecond, "sahte Yahoo'nun cevap gecikmesi")
	rampUp := flag.Duration("ramp-up", 5*time.Second, "kullanıcıların başlamasının yayıldığı süre (hepsi aynı anda bağlanırsa Windows bağlantıları reddediyor)")
	blockAfter := flag.Int64("block-after", 0, "bu kadar Yahoo isteğinden sonra sahte Yahoo hep 429 dönsün (0: hiç)")
	stockCount := flag.Int("stocks", 60, "kullanıcıların baktığı hisse sayısı (popüler olanlara ağırlıklı)")
	fundIDs := flag.String("funds", "", "geçmişi olan fon ID'leri, virgülle (geçmişi olmayan fon gerçek TEFAS'ı tetikler)")
	user := flag.String("user", "demo", "portföy grafiği için giriş yapılacak kullanıcı")
	pass := flag.String("pass", "demo12345", "şifresi (yerel demo verisi)")
	flag.Parse()

	fy := newFakeYahoo(*latency, *blockAfter)
	go func() {
		if err := http.ListenAndServe(*fakeAddr, fy); err != nil {
			fmt.Fprintln(os.Stderr, "sahte Yahoo açılamadı:", err)
			os.Exit(1)
		}
	}()
	fmt.Println("Sahte Yahoo:", "http://"+*fakeAddr)
	if *fakeOnly {
		select {}
	}
	time.Sleep(300 * time.Millisecond)

	client := &http.Client{
		Timeout:   30 * time.Second,
		Transport: &http.Transport{MaxIdleConns: 1000, MaxIdleConnsPerHost: 1000},
	}

	// Varlık listesi. API bu programdan sonra açılabilir (sahte Yahoo önce ayakta olsun diye); 60 sn bekleriz.
	var all []asset
	var listErr error
	for range 60 {
		if listErr = getJSON(client, *api+"/assets", &all); listErr == nil {
			break
		}
		time.Sleep(time.Second)
	}
	if listErr != nil {
		fmt.Fprintln(os.Stderr, "varlık listesi alınamadı (API çalışıyor mu?):", listErr)
		os.Exit(1)
	}
	time.Sleep(5 * time.Second) // API'nin açılış işçileri (BIST ilk turu) bitsin, ölçüme karışmasın
	var stocks []asset
	for _, a := range all {
		if a.AssetType == "HISSE" {
			stocks = append(stocks, a)
		}
	}
	sort.Slice(stocks, func(i, j int) bool { return stocks[i].ID < stocks[j].ID })
	if len(stocks) > *stockCount {
		stocks = stocks[:*stockCount]
	}
	var funds []int64
	for _, s := range strings.Split(*fundIDs, ",") {
		if id, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64); err == nil {
			funds = append(funds, id)
		}
	}

	// Portföy grafiği için oturum
	jar, _ := cookiejar.New(nil)
	authClient := &http.Client{Timeout: 30 * time.Second, Jar: jar, Transport: client.Transport}
	body := fmt.Sprintf(`{"username":%q,"password":%q}`, *user, *pass)
	if resp, err := authClient.Post(*api+"/login", "application/json", strings.NewReader(body)); err != nil || resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "giriş yapılamadı, portföy grafiği testten çıkarıldı")
		authClient = nil
	} else {
		resp.Body.Close()
	}

	fmt.Printf("Başlıyor: %d kullanıcı, %v, %d hisse, %d fon, sahte Yahoo gecikmesi %v\n",
		*users, *duration, len(stocks), len(funds), *latency)
	yahooBefore := fy.total.Load() // API açılışındaki işçi istekleri ayrı tutulsun

	st := &stats{}
	deadline := time.Now().Add(*duration)
	var wg sync.WaitGroup
	for u := range *users {
		wg.Go(func() {
			ip := fmt.Sprintf("10.%d.%d.%d", u/65536, (u/256)%256, u%256)
			time.Sleep(time.Duration(u) * *rampUp / time.Duration(*users))
			for time.Now().Before(deadline) {
				r := rand.Float64()
				var action, url string
				c := client
				switch {
				case r < 0.6 || (authClient == nil && len(funds) == 0):
					// popüler hisselere ağırlıklı: küçük indeksler daha sık
					a := stocks[int(float64(len(stocks))*rand.Float64()*rand.Float64()*rand.Float64())]
					action = "hisse grafiği"
					url = fmt.Sprintf("%s/assets/%d/price-history?range=%s", *api, a.ID, stockRanges[rand.IntN(len(stockRanges))])
				case r < 0.8 && authClient != nil:
					action = "portföy grafiği"
					url = fmt.Sprintf("%s/portfolio/value-history?range=%s", *api, portfolioRanges[rand.IntN(len(portfolioRanges))])
					c = authClient
				default:
					if len(funds) == 0 {
						continue
					}
					action = "fon grafiği"
					url = fmt.Sprintf("%s/assets/%d/price-history?range=%s", *api, funds[rand.IntN(len(funds))], stockRanges[rand.IntN(len(stockRanges))])
				}
				req, _ := http.NewRequest(http.MethodGet, url, nil)
				req.Header.Set("X-Real-IP", ip)
				start := time.Now()
				resp, err := c.Do(req)
				status, errText := 0, ""
				if err == nil {
					_, _ = io.Copy(io.Discard, resp.Body)
					resp.Body.Close()
					status = resp.StatusCode
				} else {
					errText = err.Error()
					if i := strings.LastIndex(errText, ": "); i >= 0 {
						errText = errText[i+2:] // adres kısmını at, sebep kalsın
					}
				}
				st.add(sample{action: action, status: status, dur: time.Since(start), err: errText})
				// düşünme süresi: gerçek bir kullanıcı sayfalar arasında 0,5–2 sn bekler
				time.Sleep(500*time.Millisecond + time.Duration(rand.IntN(1500))*time.Millisecond)
			}
		})
	}
	wg.Wait()

	report(st, fy, yahooBefore, *duration)
}

func getJSON(c *http.Client, url string, v any) error {
	resp, err := c.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

func pct(ds []time.Duration, p float64) time.Duration {
	if len(ds) == 0 {
		return 0
	}
	return ds[min(len(ds)-1, int(float64(len(ds))*p))]
}

func report(st *stats, fy *fakeYahoo, yahooBefore int64, d time.Duration) {
	byAction := map[string][]time.Duration{}
	statusCount := map[int]int{}
	errCount := map[string]int{}
	for _, s := range st.samples {
		byAction[s.action] = append(byAction[s.action], s.dur)
		statusCount[s.status]++
		if s.err != "" {
			errCount[s.err]++
		}
	}
	fmt.Println()
	fmt.Println("=== API ===")
	fmt.Printf("Toplam istek: %d (saniyede %.0f)\n", len(st.samples), float64(len(st.samples))/d.Seconds())
	codes := make([]int, 0, len(statusCount))
	for c := range statusCount {
		codes = append(codes, c)
	}
	sort.Ints(codes)
	for _, c := range codes {
		name := strconv.Itoa(c)
		if c == 0 {
			name = "bağlantı hatası/zaman aşımı"
		}
		fmt.Printf("  HTTP %s: %d\n", name, statusCount[c])
	}
	for e, n := range errCount {
		fmt.Printf("    hata (%d kez): %s\n", n, e)
	}
	actions := make([]string, 0, len(byAction))
	for a := range byAction {
		actions = append(actions, a)
	}
	sort.Strings(actions)
	fmt.Printf("%-16s %7s %8s %8s %8s %8s\n", "", "istek", "p50", "p95", "p99", "en uzun")
	for _, a := range actions {
		ds := byAction[a]
		sort.Slice(ds, func(i, j int) bool { return ds[i] < ds[j] })
		fmt.Printf("%-16s %7d %8v %8v %8v %8v\n", a, len(ds),
			pct(ds, 0.50).Round(time.Millisecond), pct(ds, 0.95).Round(time.Millisecond),
			pct(ds, 0.99).Round(time.Millisecond), ds[len(ds)-1].Round(time.Millisecond))
	}

	fmt.Println()
	fmt.Println("=== Sahte Yahoo (dışarıya giden) ===")
	during := fy.total.Load() - yahooBefore
	fmt.Printf("Test boyunca istek: %d (API açılışındaki işçi istekleri hariç: %d)\n", during, yahooBefore)
	fmt.Printf("Kullanıcı isteği başına Yahoo isteği: %.4f\n", float64(during)/float64(max(1, len(st.samples))))
	fy.mu.Lock()
	maxPerSec := 0
	for _, n := range fy.perSecond {
		maxPerSec = max(maxPerSec, n)
	}
	fy.mu.Unlock()
	fmt.Printf("Ortalama saniyede: %.2f | en yoğun saniye: %d | aynı anda en fazla: %d\n",
		float64(during)/d.Seconds(), maxPerSec, fy.maxConc.Load())
	if fy.blockAfter > 0 {
		fmt.Printf("429 senaryosu: %d. istekten sonra engellendi; engel sırasında gelen istek: %d (devre kesici çalışıyorsa çok az olmalı)\n",
			fy.blockAfter, fy.blocked.Load())
	}
}
