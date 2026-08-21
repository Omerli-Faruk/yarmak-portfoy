package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"fmt"
	"net/http"
	"strconv"
)

// @Summary Portföy Özeti (TL ve Dolar)
// @Description Toplam portföy değeri, toplam maliyet, kâr/zarar, dolar karşılığı ve kategori dağılımını döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {object} portfolioSummaryResponse
// @Failure 401 {object} map[string]string
// @Router /portfolio/summary [get]
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

	var usdRate float64
	usdAsset, err := cfg.DB.GetAssetBySymbol(r.Context(), "USDTRY")
	if err == nil {
		usdRate, _ = strconv.ParseFloat(usdAsset.CurrentPrice, 64)
	}
	var totalValueUSD float64
	var totalProfitUSD float64
	if usdRate > 0 {
		totalValueUSD = totalPortfolioValue / usdRate
		totalProfitUSD = totalCombinedProfit / usdRate
	}
	respondWithJSON(w, http.StatusOK, portfolioSummaryResponse{
		TotalValue:                  totalPortfolioValue,
		TotalCost:                   totalPortfolioCost,
		CapitalProfitLoss:           capitalProfitLoss,
		CapitalProfitLossPercentage: capitalProfitLossPercentage,
		TotalDividends:              totalDividends,
		TotalCombinedProfit:         totalCombinedProfit,
		TotalReturnPercentage:       totalReturnPercentage,
		HoldingsCount:               len(holdings),
		Breakdown:                   breakdown,
		USDRate:                     usdRate,
		TotalValueUSD:               totalValueUSD,
		TotalCombinedProfitUSD:      totalProfitUSD,
	})
}

// @Summary Portföy Tarihsel Grafik Geçmişi
// @Description Kullanıcının portföyünün zaman içindeki gelişimini grafik için döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {array} database.PortfolioSnapshot
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /portfolio/history [get]
func (cfg *ApiConfig) HandlerGetUserPortfolioHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Kullanıcı bulunamadı", nil)
		return
	}
	history, err := cfg.DB.GetUserPortfolioHistory(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Portföy geçmişi getirilirken hata oluştu", err)
		return
	}
	if history == nil {
		history = []database.PortfolioSnapshot{}
	}
	respondWithJSON(w, http.StatusOK, history)
}
