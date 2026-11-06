package services

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"yarmak/internal/scraper"
)

// gateFakeSource, kaç kez çağrıldığını sayan sahte dış kaynak.
type gateFakeSource struct {
	calls atomic.Int32
	delay time.Duration

	mu  sync.Mutex
	err error
}

func (f *gateFakeSource) setErr(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err = err
}

func (f *gateFakeSource) result() error {
	f.calls.Add(1)
	time.Sleep(f.delay)
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.err
}

func (f *gateFakeSource) History(symbol, rng, interval string) ([]scraper.StockHistoricalRecord, error) {
	if err := f.result(); err != nil {
		return nil, err
	}
	return []scraper.StockHistoricalRecord{{Price: 1}, {Price: 2}}, nil
}

func (f *gateFakeSource) Price(symbol string) (float64, error) {
	if err := f.result(); err != nil {
		return 0, err
	}
	return 1.5, nil
}

func (f *gateFakeSource) FundPrice(symbol string) (float64, error) {
	if err := f.result(); err != nil {
		return 0, err
	}
	return 2.5, nil
}

// testClock, testin elle ilerlettiği saat.
type testClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *testClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *testClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

// hızlı sınırlı test kapısı: hız sınırı testleri yavaşlatmasın diye saniyede 1000 istek.
func newTestGate(src PriceSource) (*gatedPriceSource, *testClock) {
	cfg := DefaultGateConfig()
	cfg.RatePerSecond = 1000
	g := NewGatedPriceSource(src, cfg)
	clock := &testClock{t: time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)}
	g.now = clock.now
	return g, clock
}

// Kanıt testi: 300 kullanıcı aynı anda aynı grafiği açar, dış kaynak bir kez çağrılır.
func TestGateCoalesces300ConcurrentRequests(t *testing.T) {
	src := &gateFakeSource{delay: 100 * time.Millisecond}
	g, _ := newTestGate(src)

	var wg sync.WaitGroup
	var failed atomic.Int32
	for i := 0; i < 300; i++ {
		wg.Go(func() {
			hist, err := g.History("THYAO", "1d", "5m")
			if err != nil || len(hist) != 2 {
				failed.Add(1)
			}
		})
	}
	wg.Wait()

	if n := src.calls.Load(); n != 1 {
		t.Errorf("300 eşzamanlı istekte dış kaynak 1 kez çağrılmalıydı, %d kez çağrıldı", n)
	}
	if n := failed.Load(); n != 0 {
		t.Errorf("%d istek veri alamadı", n)
	}
}

func TestGateCachesUntilTTL(t *testing.T) {
	src := &gateFakeSource{}
	g, clock := newTestGate(src)

	_, _ = g.History("THYAO", "1d", "5m")
	clock.advance(historyTTL("5m") - time.Second)
	_, _ = g.History("THYAO", "1d", "5m")
	if n := src.calls.Load(); n != 1 {
		t.Fatalf("süre dolmadan tekrar çağrılmamalı, %d çağrı", n)
	}

	clock.advance(2 * time.Second)
	_, _ = g.History("THYAO", "1d", "5m")
	if n := src.calls.Load(); n != 2 {
		t.Errorf("süre dolunca tazelenmeli, %d çağrı", n)
	}
}

func TestGateKeysAreSeparatePerRange(t *testing.T) {
	src := &gateFakeSource{}
	g, _ := newTestGate(src)

	_, _ = g.History("THYAO", "1d", "5m")
	_, _ = g.History("THYAO", "1mo", "1h")
	_, _ = g.History("thyao", "1d", "5m") // küçük harf aynı anahtar
	if n := src.calls.Load(); n != 2 {
		t.Errorf("iki farklı aralık için 2 çağrı bekleniyordu, %d", n)
	}
}

func TestGateBreakerOpensOn429(t *testing.T) {
	src := &gateFakeSource{}
	g, clock := newTestGate(src)
	src.setErr(fmt.Errorf("%w: THYAO.IS", scraper.ErrRateLimited))

	if _, err := g.History("THYAO", "1d", "5m"); err == nil {
		t.Fatal("429'da hata bekleniyordu")
	}
	// Devre açık: başka bir sembol için bile dışarıya gidilmemeli
	_, err := g.History("ASELS", "1d", "5m")
	if !errors.Is(err, ErrSourceUnavailable) {
		t.Errorf("devre açıkken ErrSourceUnavailable bekleniyordu, gelen: %v", err)
	}
	if n := src.calls.Load(); n != 1 {
		t.Errorf("devre açıkken dış kaynak çağrılmamalı, %d çağrı", n)
	}

	// Bekleme süresi bitince tekrar denenir
	src.setErr(nil)
	clock.advance(DefaultGateConfig().BreakerCooldown + time.Second)
	if _, err := g.History("ASELS", "1d", "5m"); err != nil {
		t.Errorf("devre kapanınca istek geçmeli: %v", err)
	}
}

func TestGateNon429ErrorDoesNotOpenBreaker(t *testing.T) {
	src := &gateFakeSource{}
	g, _ := newTestGate(src)
	src.setErr(errors.New("HTTP 404"))

	_, _ = g.History("YOKBOYLE", "1d", "5m")
	src.setErr(nil)
	if _, err := g.History("THYAO", "1d", "5m"); err != nil {
		t.Errorf("404 devreyi açmamalı: %v", err)
	}
}

func TestGateServesStaleDataWhenSourceFails(t *testing.T) {
	src := &gateFakeSource{}
	g, clock := newTestGate(src)

	if _, err := g.Price("USDTRY"); err != nil {
		t.Fatal(err)
	}
	clock.advance(priceTTL + time.Second) // süresi doldu
	src.setErr(errors.New("bağlantı koptu"))

	p, err := g.Price("USDTRY")
	if err != nil || p != 1.5 {
		t.Errorf("kaynak düşünce eski fiyat (1.5) bekleniyordu, gelen: %v, %v", p, err)
	}
}

func TestGateReturnsCopyOfHistory(t *testing.T) {
	src := &gateFakeSource{}
	g, _ := newTestGate(src)

	first, _ := g.History("THYAO", "1d", "5m")
	first[0].Price = 999 // bir çağıran kendi kopyasını bozarsa
	second, _ := g.History("THYAO", "1d", "5m")
	if second[0].Price != 1 {
		t.Errorf("önbellekteki veri bozulmamalı, gelen %v", second[0].Price)
	}
}

func TestGateEvictsOverCapacity(t *testing.T) {
	src := &gateFakeSource{}
	g, clock := newTestGate(src)
	g.cfg.MaxEntries = 3

	for _, s := range []string{"A", "B", "C", "D", "E"} {
		_, _ = g.Price(s)
		clock.advance(time.Second)
	}
	g.mu.Lock()
	n := len(g.entries)
	_, hasNewest := g.entries["P|E"]
	_, hasOldest := g.entries["P|A"]
	g.mu.Unlock()
	if n > 3 || !hasNewest || hasOldest {
		t.Errorf("tavan 3 olmalı, en yeni durup en eski atılmalı: %d kayıt, E var mı %v, A var mı %v", n, hasNewest, hasOldest)
	}
}

func TestIntervalLimiterSpacesAndGivesUp(t *testing.T) {
	l := newIntervalLimiter(10, 1) // biriktirme yok, her 100 ms'de bir
	now := time.Now()

	start := time.Now()
	for i := 0; i < 3; i++ {
		if err := l.wait(now, 250*time.Millisecond); err != nil {
			t.Fatalf("%d. istek sıraya girebilmeliydi: %v", i+1, err)
		}
	}
	if el := time.Since(start); el < 250*time.Millisecond {
		t.Errorf("3 istek 0, 100, 200 ms'de çıkmalıydı (toplam ≥ 300 ms), %v sürdü", el)
	}
	// Sıradaki boş zaman 300 ms sonra, en fazla 250 ms beklenir: vazgeçmeli
	if err := l.wait(now, 250*time.Millisecond); err == nil {
		t.Error("sıra çok uzunken hata bekleniyordu")
	}
}

func TestIntervalLimiterBurst(t *testing.T) {
	l := newIntervalLimiter(10, 3) // ortalama 100 ms'de bir, 3 hak birikebilir
	now := time.Now()

	start := time.Now()
	for i := 0; i < 3; i++ {
		if err := l.wait(now, time.Second); err != nil {
			t.Fatal(err)
		}
	}
	if el := time.Since(start); el > 50*time.Millisecond {
		t.Errorf("biriken 3 hak beklemeden harcanmalıydı, %v sürdü", el)
	}
	start = time.Now()
	if err := l.wait(now, time.Second); err != nil {
		t.Fatal(err)
	}
	if el := time.Since(start); el < 80*time.Millisecond {
		t.Errorf("hak bitince 4. istek ~100 ms beklemeliydi, %v sürdü", el)
	}
}
