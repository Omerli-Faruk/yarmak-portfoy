package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
)

// fakeQuerier, servis testleri için bellek içi veritabanı. Yalnızca servislerin kullandığı sorgular yazıldı;
// başka bir sorgu çağrılırsa gömülü nil arayüz yüzünden test panikler, beklenmeyen çağrı hemen görünür.
type fakeQuerier struct {
	database.Querier

	mu           sync.Mutex
	assets       map[int64]database.Asset
	txs          []database.Transaction
	dividends    []database.GetUserDividendsRow
	priceHistory map[int64][]database.PriceHistory
	splits       map[int64][]database.Split
	periodValues *database.GetPortfolioPeriodValuesRow
	nextTxID     int64
}

func newFakeQuerier(assets ...database.Asset) *fakeQuerier {
	f := &fakeQuerier{
		assets:       map[int64]database.Asset{},
		priceHistory: map[int64][]database.PriceHistory{},
		splits:       map[int64][]database.Split{},
		nextTxID:     1000,
	}
	for _, a := range assets {
		f.assets[a.ID] = a
	}
	return f
}

func (f *fakeQuerier) GetAllUserTransactions(_ context.Context, _ int64) ([]database.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := append([]database.Transaction(nil), f.txs...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].TransactionDate.Before(out[j].TransactionDate) })
	return out, nil
}

func (f *fakeQuerier) GetUserTransactionsForAsset(_ context.Context, arg database.GetUserTransactionsForAssetParams) ([]database.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []database.Transaction
	for _, tx := range f.txs {
		if tx.AssetID == arg.AssetID {
			out = append(out, tx)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].TransactionDate.Equal(out[j].TransactionDate) {
			return out[i].ID < out[j].ID
		}
		return out[i].TransactionDate.Before(out[j].TransactionDate)
	})
	return out, nil
}

func (f *fakeQuerier) CreateTransaction(_ context.Context, arg database.CreateTransactionParams) (database.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextTxID++
	tx := database.Transaction{
		ID: f.nextTxID, UserID: arg.UserID, AssetID: arg.AssetID, Type: arg.Type, Amount: arg.Amount,
		Price: arg.Price, TransactionDate: arg.TransactionDate, RealizedPnl: arg.RealizedPnl, Commission: arg.Commission,
	}
	f.txs = append(f.txs, tx)
	return tx, nil
}

func (f *fakeQuerier) UpdateTransactionRealizedPnL(_ context.Context, arg database.UpdateTransactionRealizedPnLParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := range f.txs {
		if f.txs[i].ID == arg.ID {
			f.txs[i].RealizedPnl = arg.RealizedPnl
			return nil
		}
	}
	return sql.ErrNoRows
}

func (f *fakeQuerier) ListSplitsByAsset(_ context.Context, assetID int64) ([]database.Split, error) {
	return f.splits[assetID], nil
}

func (f *fakeQuerier) GetUserDividends(_ context.Context, _ int64) ([]database.GetUserDividendsRow, error) {
	return f.dividends, nil
}

func (f *fakeQuerier) GetAssetByID(_ context.Context, id int64) (database.Asset, error) {
	if a, ok := f.assets[id]; ok {
		return a, nil
	}
	return database.Asset{}, sql.ErrNoRows
}

func (f *fakeQuerier) GetAssetBySymbol(_ context.Context, symbol string) (database.Asset, error) {
	for _, a := range f.assets {
		if a.Symbol == symbol {
			return a, nil
		}
	}
	return database.Asset{}, sql.ErrNoRows
}

func (f *fakeQuerier) GetAssetPriceHistoryRange(_ context.Context, arg database.GetAssetPriceHistoryRangeParams) ([]database.PriceHistory, error) {
	var out []database.PriceHistory
	for _, p := range f.priceHistory[arg.AssetID] {
		if !p.RecordedAt.Before(arg.RecordedAt) {
			out = append(out, p)
		}
	}
	return out, nil
}

// Aşağıdaki özet sorguları SQL'deki gibi işlem ve temettülerden hesaplanır.

func (f *fakeQuerier) GetUserHoldingsSummary(_ context.Context, _ int64) ([]database.GetUserHoldingsSummaryRow, error) {
	qty := map[int64]float64{}
	for _, tx := range f.txs {
		if tx.Type == "BUY" {
			qty[tx.AssetID] += parseFloatSafe(tx.Amount)
		} else {
			qty[tx.AssetID] -= parseFloatSafe(tx.Amount)
		}
	}
	var out []database.GetUserHoldingsSummaryRow
	for id, q := range qty {
		if q <= 0 {
			continue
		}
		a := f.assets[id]
		out = append(out, database.GetUserHoldingsSummaryRow{
			AssetID: id, Symbol: a.Symbol, AssetName: a.Name, AssetType: a.AssetType,
			CurrentPrice: a.CurrentPrice, TotalAmount: fmt.Sprintf("%.6f", q),
		})
	}
	return out, nil
}

func (f *fakeQuerier) GetTotalCommission(_ context.Context, _ int64) (string, error) {
	sum := 0.0
	for _, tx := range f.txs {
		sum += parseFloatSafe(tx.Commission)
	}
	return fmt.Sprintf("%.6f", sum), nil
}

func (f *fakeQuerier) GetTotalRealizedPnL(_ context.Context, _ int64) (string, error) {
	sum := 0.0
	for _, tx := range f.txs {
		if tx.Type == "SELL" {
			sum += parseFloatSafe(tx.RealizedPnl)
		}
	}
	return fmt.Sprintf("%.6f", sum), nil
}

func (f *fakeQuerier) GetTotalDividendsSummary(_ context.Context, _ int64) (string, error) {
	sum := 0.0
	for _, d := range f.dividends {
		sum += parseFloatSafe(d.NetAmount)
	}
	return fmt.Sprintf("%.6f", sum), nil
}

func (f *fakeQuerier) GetPortfolioPeriodValues(_ context.Context, _ int64) (database.GetPortfolioPeriodValuesRow, error) {
	if f.periodValues == nil {
		return database.GetPortfolioPeriodValuesRow{}, sql.ErrNoRows
	}
	return *f.periodValues, nil
}

// fakePrices, ağa çıkmayan PriceSource. Geçmiş "SEMBOL|aralık|sıklık" anahtarıyla aranır.
type fakePrices struct {
	history map[string][]scraper.StockHistoricalRecord
	prices  map[string]float64
	calls   []string
	mu      sync.Mutex
}

func (p *fakePrices) History(symbol, rng, interval string) ([]scraper.StockHistoricalRecord, error) {
	key := strings.Join([]string{symbol, rng, interval}, "|")
	p.mu.Lock()
	p.calls = append(p.calls, key)
	p.mu.Unlock()
	if h, ok := p.history[key]; ok {
		return h, nil
	}
	return nil, fmt.Errorf("sahte geçmiş yok: %s", key)
}

func (p *fakePrices) Price(symbol string) (float64, error) {
	if v, ok := p.prices[symbol]; ok {
		return v, nil
	}
	return 0, fmt.Errorf("sahte fiyat yok: %s", symbol)
}

func (p *fakePrices) FundPrice(symbol string) (float64, error) { return p.Price(symbol) }

func records(pts []PricePoint) []scraper.StockHistoricalRecord {
	out := make([]scraper.StockHistoricalRecord, len(pts))
	for i, p := range pts {
		out[i] = scraper.StockHistoricalRecord{Date: p.T, Price: p.Price}
	}
	return out
}

func dbRows(assetID int64, pts []PricePoint) []database.PriceHistory {
	out := make([]database.PriceHistory, len(pts))
	for i, p := range pts {
		out[i] = database.PriceHistory{ID: int64(i + 1), AssetID: assetID, Price: fmt.Sprintf("%.6f", p.Price), RecordedAt: p.T}
	}
	return out
}

func asset(id int64, symbol, typ string, price float64) database.Asset {
	cur := ""
	if price > 0 {
		cur = fmt.Sprintf("%.6f", price)
	}
	return database.Asset{ID: id, Symbol: symbol, Name: symbol, AssetType: typ, CurrentPrice: cur}
}

func dividendRow(assetID int64, at time.Time, net float64) database.GetUserDividendsRow {
	n := fmt.Sprintf("%.6f", net)
	return database.GetUserDividendsRow{AssetID: assetID, PaymentDate: at, NetAmount: n, GrossAmount: n, Amount: n, TaxAmount: "0"}
}

// newTestPortfolioService, sahte kaynaklarla ve sabit saatle servis kurar.
func newTestPortfolioService(q *fakeQuerier, p *fakePrices, now time.Time) *PortfolioService {
	s := NewPortfolioService(q, p)
	s.now = func() time.Time { return now }
	return s
}
