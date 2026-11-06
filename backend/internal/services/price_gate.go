package services

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"yarmak/internal/scraper"
)

// intervalLimiter, dış istekleri sıraya koyan basit bir token bucket: ortalama hız perSecond,
// ama sistem boştayken burst kadar istek hakkı birikir ve ani ihtiyaçta hemen harcanır.
// Her gelen bir sonraki boş zamanı ayırır; o zaman çok uzaksa ayırmadan vazgeçer.
type intervalLimiter struct {
	mu          sync.Mutex
	gap         time.Duration // iki istek arası ortalama süre (2/sn için 500 ms)
	burstWindow time.Duration // biriken hakkın üst sınırı, süre cinsinden
	next        time.Time     // bir sonraki boş zaman
}

func newIntervalLimiter(perSecond float64, burst int) *intervalLimiter {
	gap := time.Duration(float64(time.Second) / perSecond)
	if burst < 1 {
		burst = 1
	}
	return &intervalLimiter{gap: gap, burstWindow: gap * time.Duration(burst-1)}
}

// wait, sıradaki zamana kadar bekler. Beklenecek süre maxWait'ten uzunsa sıraya girmeden hata döner.
func (l *intervalLimiter) wait(now time.Time, maxWait time.Duration) error {
	l.mu.Lock()
	// Boşta geçen süre hak biriktirir, ama en fazla burst kadar
	if earliest := now.Add(-l.burstWindow); l.next.Before(earliest) {
		l.next = earliest
	}
	d := l.next.Sub(now)
	if d > maxWait {
		l.mu.Unlock()
		return errors.New("sıra çok uzun")
	}
	l.next = l.next.Add(l.gap)
	l.mu.Unlock()

	if d > 0 {
		time.Sleep(d)
	}
	return nil
}

// ErrSourceUnavailable, dış kaynağa şu an sorulamadığını bildirir (devre açık ya da sıra dolu) ve elde eski veri de yoktur.
var ErrSourceUnavailable = errors.New("fiyat kaynağı şu an kullanılamıyor")

// GateConfig, dış fiyat kaynaklarına giden isteklerin sınırları.
type GateConfig struct {
	RatePerSecond   float64       // dışarıya ortalama saniyede kaç istek gider
	Burst           int           // boşta biriken, ani ihtiyaçta hemen harcanabilen istek hakkı
	MaxWait         time.Duration // bir isteğin sıra bekleme süresi; dolarsa eski veri ya da hata döner
	BreakerCooldown time.Duration // 429 alındıktan sonra hiç istek atılmayan süre
	MaxEntries      int           // önbellekteki en fazla kayıt
	StaleFor        time.Duration // süresi dolmuş kaydın yedek olarak tutulduğu süre
}

// DefaultGateConfig: kullanıcı sayısından bağımsız olarak dışarıya ortalama saniyede 2 istek (saatte 7.200),
// ani ihtiyaçta 20 istek hemen. Yahoo'nun resmî bir sınırı yok; 429 gelirse devre kesici devreye girer.
func DefaultGateConfig() GateConfig {
	return GateConfig{
		RatePerSecond:   2,
		Burst:           20,
		MaxWait:         3 * time.Second,
		BreakerCooldown: 5 * time.Minute,
		MaxEntries:      5000,
		StaleFor:        24 * time.Hour,
	}
}

type gateEntry struct {
	value     any
	fetchedAt time.Time
	expires   time.Time
}

// gatedPriceSource, PriceSource'u saran kapı. Kullanıcı isteklerini dış isteklerden koparır:
// önbellek (sembol+aralık başına ortak kopya), singleflight (aynı anda gelen aynı istek tek çağrı),
// genel hız sınırı ve 429 sonrası devre kesici. Dış kaynak düşerse süresi geçmiş kayıt gösterilir.
type gatedPriceSource struct {
	next    PriceSource
	cfg     GateConfig
	limiter *intervalLimiter
	group   singleflight.Group
	now     func() time.Time

	mu           sync.Mutex
	entries      map[string]gateEntry
	breakerUntil time.Time
}

// NewGatedPriceSource, next'i verilen sınırlarla saran kapıyı döner.
func NewGatedPriceSource(next PriceSource, cfg GateConfig) *gatedPriceSource {
	return &gatedPriceSource{
		next:    next,
		cfg:     cfg,
		limiter: newIntervalLimiter(cfg.RatePerSecond, cfg.Burst),
		now:     time.Now,
		entries: make(map[string]gateEntry),
	}
}

// historyTTL, geçmişin önbellekte taze sayıldığı süre; veri sıklığı ne kadar seyrekse o kadar uzun.
func historyTTL(interval string) time.Duration {
	switch interval {
	case "1m", "2m", "5m":
		return 3 * time.Minute
	case "15m", "30m":
		return 10 * time.Minute
	case "60m", "90m", "1h":
		return 30 * time.Minute
	case "1d":
		return 2 * time.Hour
	default: // 1wk, 1mo
		return 6 * time.Hour
	}
}

const (
	priceTTL     = time.Minute      // hisse, döviz, altın güncel fiyatı
	fundPriceTTL = 10 * time.Minute // TEFAS fiyatı günde bir açıklanıyor
)

func (g *gatedPriceSource) History(symbol, rng, interval string) ([]scraper.StockHistoricalRecord, error) {
	key := "H|" + strings.ToUpper(symbol) + "|" + rng + "|" + interval
	v, err := g.load(key, historyTTL(interval), func() (any, error) {
		return g.next.History(symbol, rng, interval)
	})
	if err != nil {
		return nil, err
	}
	// Önbellekteki dilim herkesle paylaşılıyor; çağıran sıralar ya da değiştirirse diğerleri bozulmasın diye kopya veriyoruz.
	hist := v.([]scraper.StockHistoricalRecord)
	return append([]scraper.StockHistoricalRecord(nil), hist...), nil
}

func (g *gatedPriceSource) Price(symbol string) (float64, error) {
	v, err := g.load("P|"+strings.ToUpper(symbol), priceTTL, func() (any, error) {
		return g.next.Price(symbol)
	})
	if err != nil {
		return 0, err
	}
	return v.(float64), nil
}

func (g *gatedPriceSource) FundPrice(symbol string) (float64, error) {
	v, err := g.load("F|"+strings.ToUpper(symbol), fundPriceTTL, func() (any, error) {
		return g.next.FundPrice(symbol)
	})
	if err != nil {
		return 0, err
	}
	return v.(float64), nil
}

// load: önce önbellek, yoksa kapıdan geçerek dış kaynağa sor.
func (g *gatedPriceSource) load(key string, ttl time.Duration, fetch func() (any, error)) (any, error) {
	if v, fresh, ok := g.lookup(key, g.now()); ok && fresh {
		return v, nil // taze kayıt var, dışarıya hiç gitme
	}

	// Aynı key için aynı anda tek uçuş: 300 istek gelse de fetch bir kez çalışır, hepsi aynı sonucu alır.
	v, err, _ := g.group.Do(key, func() (any, error) {
		return g.fetchThroughGate(key, ttl, fetch)
	})

	if err == nil {
		return v, nil
	}
	// Dış kaynak olmadı: süresi geçmiş ama elde duran kaydı göster
	if old, _, ok := g.lookup(key, g.now()); ok {
		slog.Warn("Fiyat kaynağı kullanılamadı, eski veri gösteriliyor", "key", key, "error", err)
		return old, nil
	}
	return nil, err
}

// fetchThroughGate, devre kesici ve hız sınırından geçip dış kaynağı bir kez çağırır, sonucu önbelleğe yazar.
func (g *gatedPriceSource) fetchThroughGate(key string, ttl time.Duration, fetch func() (any, error)) (any, error) {
	// Bir önceki uçuş az önce doldurmuş olabilir
	if v, fresh, ok := g.lookup(key, g.now()); ok && fresh {
		return v, nil
	}
	if g.breakerOpen() {
		return nil, fmt.Errorf("%w: istek sınırı nedeniyle bekleniyor", ErrSourceUnavailable)
	}

	if err := g.limiter.wait(g.now(), g.cfg.MaxWait); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSourceUnavailable, err)
	}

	v, err := fetch()
	if err != nil {
		// Yahoo bizi sınırladıysa bir süre hiç sormuyoruz; ısrar etmek ban süresini uzatır.
		if errors.Is(err, scraper.ErrRateLimited) {
			g.openBreaker()
		}
		return nil, err
	}
	g.store(key, v, ttl)
	return v, nil
}

// lookup, kaydı döner. fresh: süresi dolmamış. ok: yedek olarak hâlâ kullanılabilir.
func (g *gatedPriceSource) lookup(key string, now time.Time) (v any, fresh bool, ok bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	e, found := g.entries[key]
	if !found || now.After(e.expires.Add(g.cfg.StaleFor)) {
		return nil, false, false
	}
	return e.value, now.Before(e.expires), true
}

func (g *gatedPriceSource) store(key string, v any, ttl time.Duration) {
	now := g.now()
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.entries) >= g.cfg.MaxEntries {
		g.evictLocked(now)
	}
	g.entries[key] = gateEntry{value: v, fetchedAt: now, expires: now.Add(ttl)}
}

// evictLocked, önce yedek süresi de geçmiş kayıtları siler; tavan hâlâ doluysa en eski çekilmiş kaydı atar.
// g.mu tutulurken çağrılmalı.
func (g *gatedPriceSource) evictLocked(now time.Time) {
	for k, e := range g.entries {
		if now.After(e.expires.Add(g.cfg.StaleFor)) {
			delete(g.entries, k)
		}
	}
	for len(g.entries) >= g.cfg.MaxEntries {
		var oldestKey string
		var oldest time.Time
		for k, e := range g.entries {
			if oldestKey == "" || e.fetchedAt.Before(oldest) {
				oldestKey, oldest = k, e.fetchedAt
			}
		}
		delete(g.entries, oldestKey)
	}
}

func (g *gatedPriceSource) openBreaker() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.breakerUntil = g.now().Add(g.cfg.BreakerCooldown)
	slog.Warn("Fiyat kaynağı 429 döndü, dış istekler durduruldu", "until", g.breakerUntil.Format(time.TimeOnly))
}

func (g *gatedPriceSource) breakerOpen() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.now().Before(g.breakerUntil)
}
