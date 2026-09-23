package handlers

import (
	"math"
	"yarmak/internal/database"
	"yarmak/internal/scraper"

	"net/http"
	"strconv"
)

// HandlerGetPortfolioSummary — Kullanıcının portföyünün tüm anlık resmini çıkarır.
// Toplam değer, maliyet, kâr/zarar, dolar karşılığı, dönemsel getiriler (1D/1W/1M/3M/6M/YTD/1Y)
// ve HISSE/FON/ALTIN/DOVIZ bazında kategori dağılımını tek seferde hesaplayıp döner.
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
	totalCommissionStr, err := cfg.DB.GetTotalCommission(r.Context(), userID)
	if err != nil {
		totalCommissionStr = "0.000000"
	}
	totalCommission, _ := strconv.ParseFloat(totalCommissionStr, 64)
	holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
	if err != nil {
		holdings = []database.GetUserHoldingsSummaryRow{}
	}
	totalDividendsStr, err := cfg.DB.GetTotalDividendsSummary(r.Context(), userID)
	if err != nil {
		totalDividendsStr = "0.000000"
	}
	totalRealizedStr, err := cfg.DB.GetTotalRealizedPnL(r.Context(), userID)
	if err != nil {
		totalRealizedStr = "0.000000"
	}
	totalRealizedPnL, _ := strconv.ParseFloat(totalRealizedStr, 64)

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

	allTxs, _ := cfg.DB.GetAllUserTransactions(r.Context(), userID)
	txsByAsset := make(map[int64][]database.Transaction)
	for _, tx := range allTxs {
		txsByAsset[tx.AssetID] = append(txsByAsset[tx.AssetID], tx)
	}
	for _, h := range holdings {
		currentPrice, _ := strconv.ParseFloat(h.CurrentPrice, 64)
		totalAmount, _ := strconv.ParseFloat(h.TotalAmount, 64)
		userTxs := txsByAsset[h.AssetID]
		_, averageCost := scraper.CalculateAssetHoldingAndCost(userTxs)
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
	totalCombinedProfit := capitalProfitLoss + totalRealizedPnL + totalDividends
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
	if usdRate <= 0 {
		usdRate, _ = scraper.FetchBISTPrice("USDTRY")
	}
	var totalValueUSD float64
	var totalProfitUSD float64
	if usdRate > 0 {
		totalValueUSD = totalPortfolioValue / usdRate
		totalProfitUSD = totalCombinedProfit / usdRate
	}

	periodReturns := make(map[string]float64)
	periodValues := make(map[string]float64)

	if len(holdings) > 0 && totalPortfolioValue > 0 {
		var valCur, val1d, val1w, val1m, val3m, val6m, valYtd, val1y, val3y, val5y float64
		periodQuery := `
		WITH user_holdings AS (
			SELECT asset_id, SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) as qty
			FROM transactions
			WHERE user_id = $1 AND deleted_at IS NULL
			GROUP BY asset_id
			HAVING SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) > 0
		),
		latest_prices AS (
			SELECT uh.asset_id, uh.qty,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC LIMIT 1), 0) as p_cur,
				COALESCE(
					(SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at < CURRENT_DATE ORDER BY ph.recorded_at DESC LIMIT 1),
					(SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC OFFSET 1 LIMIT 1),
					0
				) as p_1d,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1w,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '30 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1m,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '90 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_3m,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '180 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_6m,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= date_trunc('year', CURRENT_DATE) ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_ytd,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '1 year' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1y,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '3 years' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_3y,
				COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '5 years' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_5y
			FROM user_holdings uh
		)
		SELECT 
			COALESCE(SUM(qty * CASE WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_1d > 0 THEN p_1d WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_1w > 0 THEN p_1w WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_1m > 0 THEN p_1m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_3m > 0 THEN p_3m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_6m > 0 THEN p_6m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_ytd > 0 THEN p_ytd WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_1y > 0 THEN p_1y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_3y > 0 THEN p_3y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0),
			COALESCE(SUM(qty * CASE WHEN p_5y > 0 THEN p_5y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)
		FROM latest_prices;
		`
		errRow := cfg.DBConn.QueryRowContext(r.Context(), periodQuery, userID).Scan(
			&valCur, &val1d, &val1w, &val1m, &val3m, &val6m, &valYtd, &val1y, &val3y, &val5y,
		)
		if errRow == nil && valCur > 0 {
			calcPct := func(baseVal float64) float64 {
				if baseVal <= 0 {
					return 0
				}
				return round2(((valCur - baseVal) / baseVal) * 100)
			}
			periodValues["CURRENT"] = round2(valCur)
			periodValues["1D"] = round2(val1d)
			periodValues["1W"] = round2(val1w)
			periodValues["1M"] = round2(val1m)
			periodValues["3M"] = round2(val3m)
			periodValues["6M"] = round2(val6m)
			periodValues["YTD"] = round2(valYtd)
			periodValues["1Y"] = round2(val1y)
			periodValues["3Y"] = round2(val3y)
			periodValues["5Y"] = round2(val5y)

			periodReturns["1D"] = calcPct(val1d)
			periodReturns["1W"] = calcPct(val1w)
			periodReturns["1M"] = calcPct(val1m)
			periodReturns["3M"] = calcPct(val3m)
			periodReturns["6M"] = calcPct(val6m)
			periodReturns["YTD"] = calcPct(valYtd)
			periodReturns["1Y"] = calcPct(val1y)
			periodReturns["3Y"] = calcPct(val3y)
			periodReturns["5Y"] = calcPct(val5y)
			periodReturns["ALL"] = round2(capitalProfitLossPercentage)
		}
	}

	respondWithJSON(w, http.StatusOK, portfolioSummaryResponse{
		TotalValue:                  round2(totalPortfolioValue),
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
	})
}

// @Summary Portföy Tarihsel Grafik Geçmişi
// @Description Kullanıcının portföyünün zaman içindeki gelişimini grafik için döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {array} database.PortfolioSnapshot
// @Failure 401 {object} map[string]string
// HandlerGetUserPortfolioHistory — Kullanıcının portföy değer geçmişini döner.
// Dashboard'daki çizgi grafiğinin veri kaynağı budur. Son 365 snapshot döner.
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

// round2 — Finansal gösterim için 2 ondalık basamağa yuvarlar.
func round2(val float64) float64 {
	return math.Round(val*100) / 100
}
