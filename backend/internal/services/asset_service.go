package services

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
	"yarmak/internal/database"
)

// AssetService, varlık verileri, fiyat geçmişi ve harici piyasa sorgulamalarını yöneten servis.
// Thread-safe in-memory cache içerir; tekrarlanan varlık aramalarında veritabanı yükünü sıfıra indirir.
type AssetService struct {
	DB         database.Querier
	Prices     PriceSource
	cacheMu    sync.RWMutex
	assetCache map[string]database.Asset // key: symbol
	idCache    map[int64]database.Asset  // key: id
}

// NewAssetService, yeni AssetService örneği oluşturur ve bellek içi önbelleği ilklendirir.
func NewAssetService(db database.Querier, prices PriceSource) *AssetService {
	return &AssetService{
		DB:         db,
		Prices:     prices,
		assetCache: make(map[string]database.Asset),
		idCache:    make(map[int64]database.Asset),
	}
}

// GetAssetByIDWithCache, varlığı ID ile sorgularken bellek içi önbelleği kontrol eder, yoksa DB'den çeker ve önbelleğe yazar.
func (s *AssetService) GetAssetByIDWithCache(ctx context.Context, assetID int64) (database.Asset, error) {
	s.cacheMu.RLock()
	cached, ok := s.idCache[assetID]
	s.cacheMu.RUnlock()
	if ok {
		return cached, nil
	}

	asset, err := s.DB.GetAssetByID(ctx, assetID)
	if err != nil {
		return database.Asset{}, err
	}

	s.cacheMu.Lock()
	s.idCache[asset.ID] = asset
	s.assetCache[asset.Symbol] = asset
	s.cacheMu.Unlock()

	return asset, nil
}

// FetchPriceHistoryByRange, varlığın istenen periyottaki geçmiş fiyatlarını veritabanından çeker.
func (s *AssetService) FetchPriceHistoryByRange(ctx context.Context, assetID int64, rangeParam string) ([]database.PriceHistory, error) {
	switch strings.ToUpper(strings.TrimSpace(rangeParam)) {
	case "1Y":
		cutoff := time.Now().AddDate(-1, 0, 0)
		return s.DB.GetAssetPriceHistoryWeekly(ctx, database.GetAssetPriceHistoryWeeklyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	case "ALL", "5Y":
		cutoff := time.Now().AddDate(-10, 0, 0)
		return s.DB.GetAssetPriceHistoryMonthly(ctx, database.GetAssetPriceHistoryMonthlyParams{
			AssetID:    assetID,
			RecordedAt: cutoff,
		})
	default:
		return s.DB.GetAssetPriceHistory(ctx, assetID)
	}
}

// symbolPattern, dış kaynaklara sorulabilecek sembollerin biçimi (THYAO, USDTRY, GC=F, AAPL.IS gibi).
// Sembol URL'e eklendiği için başka karakterlere izin verilmez.
var symbolPattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9.=]{0,19}$`)

// normalizeSymbol, kullanıcı kısaltmalarını (USD, ALTIN...) sistemdeki sembol ve türe çevirir.
func normalizeSymbol(symbol, assetType string) (string, string) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	assetType = strings.ToUpper(strings.TrimSpace(assetType))

	switch symbol {
	case "USD", "DOLAR":
		symbol = "USDTRY"
		assetType = "DOVIZ"
	case "EUR", "EURO":
		symbol = "EURTRY"
		assetType = "DOVIZ"
	case "GBP", "STERLIN":
		symbol = "GBPTRY"
		assetType = "DOVIZ"
	case "ALTIN", "GRAMALTIN", "GRAM":
		symbol = "ALTIN"
		assetType = "ALTIN"
	}
	return symbol, assetType
}

// FindAssetBySymbol, varlığı yalnızca önbellekte ve veritabanında arar; dış kaynaklara gitmez.
func (s *AssetService) FindAssetBySymbol(ctx context.Context, symbol string) (database.Asset, error) {
	symbol, _ = normalizeSymbol(symbol, "")

	s.cacheMu.RLock()
	cached, ok := s.assetCache[symbol]
	s.cacheMu.RUnlock()
	if ok {
		return cached, nil
	}

	// 2. Veritabanı Sorgusu
	asset, err := s.DB.GetAssetBySymbol(ctx, symbol)
	if err == nil {
		s.cacheMu.Lock()
		s.assetCache[symbol] = asset
		s.idCache[asset.ID] = asset
		s.cacheMu.Unlock()
		return asset, nil
	}
	return database.Asset{}, err
}

// GetOrCreateAssetBySymbol, varlığı önce sistemde arar; yoksa fiyatını dış kaynaklardan (Yahoo, TEFAS)
// çekip veritabanına ekler.
func (s *AssetService) GetOrCreateAssetBySymbol(ctx context.Context, symbol, assetType string) (database.Asset, error) {
	symbol, assetType = normalizeSymbol(symbol, assetType)

	if asset, err := s.FindAssetBySymbol(ctx, symbol); err == nil {
		return asset, nil
	}

	if !symbolPattern.MatchString(symbol) {
		return database.Asset{}, fmt.Errorf("geçersiz sembol: %q", symbol)
	}

	var livePrice float64
	var fetchErr error
	if assetType == "HISSE" || assetType == "ALTIN" || assetType == "DOVIZ" {
		livePrice, fetchErr = s.Prices.Price(symbol)
	} else if assetType == "FON" {
		livePrice, fetchErr = s.Prices.FundPrice(symbol)
	} else {
		return database.Asset{}, fmt.Errorf("varlık piyasada bulunamadı: %s", symbol)
	}
	if fetchErr != nil {
		return database.Asset{}, fmt.Errorf("varlık fiyatı çekilemedi (%s): %w", symbol, fetchErr)
	}
	if livePrice <= 0 {
		return database.Asset{}, fmt.Errorf("varlık fiyatı 0 veya negatif (%s)", symbol)
	}

	priceStr := fmt.Sprintf("%.6f", livePrice)
	newAsset, err := s.DB.CreateAsset(ctx, database.CreateAssetParams{
		Symbol:       symbol,
		Name:         symbol,
		AssetType:    assetType,
		CurrentPrice: priceStr,
	})
	if err != nil {
		assetBySymbol, err := s.DB.GetAssetBySymbol(ctx, symbol)
		if err != nil {
			return database.Asset{}, fmt.Errorf("varlık veritabanına kaydedilemedi (%s): %w", symbol, err)
		}
		s.cacheMu.Lock()
		s.assetCache[symbol] = assetBySymbol
		s.idCache[assetBySymbol.ID] = assetBySymbol
		s.cacheMu.Unlock()
		return assetBySymbol, nil
	}

	_, _ = s.DB.CreatePriceHistory(ctx, database.CreatePriceHistoryParams{
		AssetID:    newAsset.ID,
		Price:      priceStr,
		RecordedAt: time.Now().UTC(),
	})

	// Yeni oluşturulan varlığı önbelleğe kaydet
	s.cacheMu.Lock()
	s.assetCache[newAsset.Symbol] = newAsset
	s.idCache[newAsset.ID] = newAsset
	s.cacheMu.Unlock()

	return newAsset, nil
}
