package handlers

import (
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
		respondWithError(w, http.StatusNotFound, "Portföyünüzde varlık bulunamadı", err)
		return
	}
	var totalPortfolioValue float64
	var totalPortfolioCost float64
	var profitLossPercentage float64
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		avgCostStr := fmt.Sprintf("%v", h.AverageCost)
		averageCost, _ := strconv.ParseFloat(avgCostStr, 64)

		if currentPrice <= 0 {
			currentPrice = averageCost
		}
		totalPortfolioValue += currentPrice * totalAmount
		totalPortfolioCost += averageCost * totalAmount
	}
	totalProfitLoss := totalPortfolioValue - totalPortfolioCost
	if totalPortfolioCost > 0 {
		profitLossPercentage = (totalProfitLoss / totalPortfolioCost) * 100
	} else {
		totalProfitLoss = 0
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"total_value":            totalPortfolioValue,
		"total_cost":             totalPortfolioCost,
		"total_profit_loss":      totalProfitLoss,
		"profit_loss_percentage": profitLossPercentage,
		"holdings_count":         len(holdings),
	})
}
