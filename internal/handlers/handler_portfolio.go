package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"fmt"
	"net/http"
	"strconv"
)

func (cfg *ApiConfig) HandlerGetPortfolioSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
	if err != nil {
		holdings = []database.GetUserHoldingsSummaryRow{}
	}
	totalDividendsStr, err := cfg.DB.GetTotalDividendsSummary(r.Context(), userID)
	if err != nil {
		totalDividendsStr = "0.000000"
	}
	totalDividends, _ := strconv.ParseFloat(totalDividendsStr, 64)
	var totalPortfolioValue float64
	var totalPortfolioCost float64
	type AssetCategorySummary struct {
		Value      float64 `json:"value"`
		Cost       float64 `json:"cost"`
		ProfitLoss float64 `json:"profit_loss"`
	}
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
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		var avgCostStr string
		switch v := h.AverageCost.(type) {
		case string:
			avgCostStr = v
		case []byte:
			avgCostStr = string(v)
		default:
			avgCostStr = fmt.Sprintf("%v", v)
		}
		averageCost, _ := strconv.ParseFloat(avgCostStr, 64)

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
	capitalProfitLoss := totalPortfolioValue - totalPortfolioCost
	totalCombinedProfit := capitalProfitLoss + totalDividends
	var capitalProfitLossPercentage float64
	var totalReturnPercentage float64
	if totalPortfolioCost > 0 {
		capitalProfitLossPercentage = (capitalProfitLoss / totalPortfolioCost) * 100
		totalReturnPercentage = (totalCombinedProfit / totalPortfolioCost) * 100
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"total_value":                    totalPortfolioValue,
		"total_cost":                     totalPortfolioCost,
		"capital_profit_loss":            capitalProfitLoss,
		"capital_profit_loss_percentage": capitalProfitLossPercentage,
		"total_dividends":                totalDividends,
		"total_combined_profit":          totalCombinedProfit,
		"total_return_percentage":        totalReturnPercentage,
		"holdings_count":                 len(holdings),
		"breakdown":                      breakdown,
	})
}
