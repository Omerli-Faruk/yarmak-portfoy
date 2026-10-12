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

	periodReturns := make(map[string]float64)
	periodValues := make(map[string]float64)

	if len(holdings) > 0 && totalPortfolioValue > 0 {
		pv, err := s.DB.GetPortfolioPeriodValues(ctx, userID)
		if err == nil && pv.ValCur > 0 {
			calcPct := func(baseVal float64) float64 {
				if baseVal <= 0 {
					return 0.0
				}
				return round2(((pv.ValCur - baseVal) / baseVal) * 100.0)
			}

			periodValues["CURRENT"] = round2(pv.ValCur)
			periodValues["1D"] = round2(pv.Val1d)
			periodValues["1W"] = round2(pv.Val1w)
			periodValues["1M"] = round2(pv.Val1m)
			periodValues["3M"] = round2(pv.Val3m)
			periodValues["6M"] = round2(pv.Val6m)
			periodValues["YTD"] = round2(pv.ValYtd)
			periodValues["1Y"] = round2(pv.Val1y)
			periodValues["3Y"] = round2(pv.Val3y)
			periodValues["5Y"] = round2(pv.Val5y)

			periodReturns["1D"] = calcPct(pv.Val1d)
			periodReturns["1W"] = calcPct(pv.Val1w)
			periodReturns["1M"] = calcPct(pv.Val1m)
			periodReturns["3M"] = calcPct(pv.Val3m)
			periodReturns["6M"] = calcPct(pv.Val6m)
			periodReturns["YTD"] = calcPct(pv.ValYtd)
			periodReturns["1Y"] = calcPct(pv.Val1y)
			periodReturns["3Y"] = calcPct(pv.Val3y)
			periodReturns["5Y"] = calcPct(pv.Val5y)
			periodReturns["ALL"] = round2(capitalProfitLossPercentage)
		} else if err != nil {
			slog.Debug("Portföy dönemsel değerleri sorgulanamadı", "user_id", userID, "error", err)
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
