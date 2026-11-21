package services

import (
	"context"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"
	"yarmak/internal/database"
)

type PortfolioService struct {
	DB     database.Querier
	Prices PriceSource
	// now, şimdiki zaman; testlerde sabitlenebilsin diye alan.
	now func() time.Time
	// historyCache, /portfolio/value-history sonuçlarını kısa süre tutar.
	historyCache valueHistoryCache
}

func NewPortfolioService(db database.Querier, prices PriceSource) *PortfolioService {
	return &PortfolioService{DB: db, Prices: prices, now: time.Now}
}

func parseFloatSafe(s string) float64 {
	val, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0.0
	}
	return val
}

func getParsedValue(val string, err error) float64 {
	if err != nil {
		return 0.0
	}
	return parseFloatSafe(val)
}

func Round2(val float64) float64 {
	return math.Round(val*100) / 100
}

func round2(val float64) float64 {
	return Round2(val)
}

func (s *PortfolioService) CalculatePortfolioSummary(ctx context.Context, userID int64) (PortfolioSummaryResult, error) {
	totalCommission := getParsedValue(s.DB.GetTotalCommission(ctx, userID))
	totalDividends := getParsedValue(s.DB.GetTotalDividendsSummary(ctx, userID))
	totalRealizedPnL := getParsedValue(s.DB.GetTotalRealizedPnL(ctx, userID))

	holdings, err := s.DB.GetUserHoldingsSummary(ctx, userID)
	if err != nil {
		holdings = []database.GetUserHoldingsSummaryRow{}
	}

	var totalPortfolioValue float64
	var totalPortfolioCost float64
	breakdown := map[string]*AssetCategorySummary{
		"HISSE": {},
		"FON":   {},
		"ALTIN": {},
		"DOVIZ": {},
		"TEMETTU": {
			Value:      totalDividends,
			Cost:       0,
			ProfitLoss: totalDividends,
		},
	}

	allTxs, _ := s.DB.GetAllUserTransactions(ctx, userID)
	txsByAsset := make(map[int64][]database.Transaction)
	for _, tx := range allTxs {
		txsByAsset[tx.AssetID] = append(txsByAsset[tx.AssetID], tx)
	}

	for _, h := range holdings {
		currentPrice := parseFloatSafe(h.CurrentPrice)
		totalAmount := parseFloatSafe(h.TotalAmount)
		userTxs := txsByAsset[h.AssetID]
		_, averageCost := CalculateAssetHoldingAndCost(userTxs)
		if currentPrice <= 0 {
			currentPrice = averageCost
		}
		if cat, ok := breakdown[h.AssetType]; ok {
			cat.Value += currentPrice * totalAmount
			cat.Cost += averageCost * totalAmount
			cat.ProfitLoss = cat.Value - cat.Cost
		}

		totalPortfolioValue += currentPrice * totalAmount
		totalPortfolioCost += averageCost * totalAmount
	}

	totalPortfolioValueWithDividends := totalPortfolioValue + totalDividends
	capitalProfitLoss := totalPortfolioValue - totalPortfolioCost
	totalCombinedProfit := capitalProfitLoss + totalRealizedPnL + totalDividends
	var capitalProfitLossPercentage float64
	var totalReturnPercentage float64
	if totalPortfolioCost > 0 {
		capitalProfitLossPercentage = (capitalProfitLoss / totalPortfolioCost) * 100
		totalReturnPercentage = (totalCombinedProfit / totalPortfolioCost) * 100
	}

	var usdRate float64
	usdAsset, err := s.DB.GetAssetBySymbol(ctx, "USDTRY")
	if err == nil {
		usdRate = parseFloatSafe(usdAsset.CurrentPrice)
	}
	if usdRate <= 0 {
		usdRate, _ = s.Prices.Price("USDTRY")
	}

	var totalValueUSD float64
	var totalProfitUSD float64
	if usdRate > 0 {
		totalValueUSD = totalPortfolioValueWithDividends / usdRate
		totalProfitUSD = totalCombinedProfit / usdRate
	}

	periodReturns := map[string]float64{}
	periodValues := map[string]float64{}

	if len(holdings) > 0 && totalPortfolioValue > 0 {
		rows, err := s.DB.GetPortfolioPeriodPrices(ctx, userID)
		if err == nil {
			periodReturns, periodValues = portfolioPeriodReturns(rows)
			if _, ok := periodValues["CURRENT"]; ok {
				periodReturns["ALL"] = round2(capitalProfitLossPercentage)
			}
		} else {
			slog.Debug("Portföy dönem fiyatları sorgulanamadı", "user_id", userID, "error", err)
		}
	}

	return PortfolioSummaryResult{
		TotalValue:                  round2(totalPortfolioValueWithDividends),
		TotalEquityValue:            round2(totalPortfolioValue),
		TotalCost:                   round2(totalPortfolioCost),
		CapitalProfitLoss:           round2(capitalProfitLoss),
		CapitalProfitLossPercentage: round2(capitalProfitLossPercentage),
		TotalDividends:              round2(totalDividends),
		TotalCombinedProfit:         round2(totalCombinedProfit),
		TotalReturnPercentage:       round2(totalReturnPercentage),
		HoldingsCount:               len(holdings),
		Breakdown:                   breakdown,
		USDRate:                     round2(usdRate),
		TotalValueUSD:               round2(totalValueUSD),
		TotalCombinedProfitUSD:      round2(totalProfitUSD),
		RealizedProfitLoss:          round2(totalRealizedPnL),
		TotalCommission:             round2(totalCommission),
		PeriodReturns:               periodReturns,
		PeriodValues:                periodValues,
	}, nil
}

// portfolioPeriods, dönem kodu ve satırdan o dönemin başındaki fiyatı okuyan fonksiyon.
var portfolioPeriods = []struct {
	key  string
	base func(database.GetPortfolioPeriodPricesRow) float64
}{
	{"1D", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P1d }},
	{"1W", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P1w }},
	{"1M", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P1m }},
	{"3M", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P3m }},
	{"6M", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P6m }},
	{"YTD", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.PYtd }},
	{"1Y", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P1y }},
	{"3Y", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P3y }},
	{"5Y", func(r database.GetPortfolioPeriodPricesRow) float64 { return r.P5y }},
}

// portfolioPeriodReturns, eldeki varlıkların bugünkü ve dönem başı fiyatlarından portföyün dönem getirilerini hesaplar.
// Bir dönemin getirisi yalnızca o dönemin başında fiyatı bilinen varlıklarla hesaplanır. Hiçbir varlığın fiyatı yoksa
// dönem haritaya yazılmaz: arayüz "veri yok" der, %0 göstermez (#10). Eskiden fiyatı olmayan varlık "değişmedi"
// sayılıp getiriyi sulandırıyordu. periodValues[dönem]: o varlıkların dönem başındaki toplam değeri.
func portfolioPeriodReturns(rows []database.GetPortfolioPeriodPricesRow) (returns, values map[string]float64) {
	returns = map[string]float64{}
	values = map[string]float64{}

	var current float64
	for _, r := range rows {
		if r.PCur > 0 {
			current += r.Qty * r.PCur
		}
	}
	if current <= 0 {
		return returns, values
	}
	values["CURRENT"] = round2(current)

	for _, p := range portfolioPeriods {
		var then, now float64
		for _, r := range rows {
			if base := p.base(r); base > 0 && r.PCur > 0 {
				then += r.Qty * base
				now += r.Qty * r.PCur
			}
		}
		if then > 0 {
			values[p.key] = round2(then)
			returns[p.key] = round2((now - then) / then * 100)
		}
	}
	return returns, values
}
