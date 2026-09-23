package handlers

import (
	"log/slog"
	"math"
	"net/http"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
)

// ============================================================================
// HELPER FONKSİYONLAR (DRY & Tip Güvenliği)
// ============================================================================

// getParsedValue — Veritabanından gelen (string, error) çıktısını veya string sayısal değeri güvenle float64'e dönüştürür.
// Hata veya boş string durumunda programı kırmadan 0.0 döner. Paket genelindeki parseFloatSafe fonksiyonunu kullanır.
func getParsedValue(val string, err error) float64 {
	if err != nil {
		return 0.0
	}
	return parseFloatSafe(val)
}

// round2 — Finansal gösterim için 2 ondalık basamağa yuvarlar.
func round2(val float64) float64 {
	return math.Round(val*100) / 100
}

// ============================================================================
// API HANDLERS
// ============================================================================

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

	// DRY & Güvenli Parse: Tekrarlayan err kontrolleri getParsedValue içine devredildi
	totalCommission := getParsedValue(cfg.DB.GetTotalCommission(r.Context(), userID))
	totalDividends := getParsedValue(cfg.DB.GetTotalDividendsSummary(r.Context(), userID))
	totalRealizedPnL := getParsedValue(cfg.DB.GetTotalRealizedPnL(r.Context(), userID))

	holdings, err := cfg.DB.GetUserHoldingsSummary(r.Context(), userID)
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

	allTxs, _ := cfg.DB.GetAllUserTransactions(r.Context(), userID)
	txsByAsset := make(map[int64][]database.Transaction)
	for _, tx := range allTxs {
		txsByAsset[tx.AssetID] = append(txsByAsset[tx.AssetID], tx)
	}

	for _, h := range holdings {
		currentPrice := parseFloatSafe(h.CurrentPrice)
		totalAmount := parseFloatSafe(h.TotalAmount)
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
		usdRate = parseFloatSafe(usdAsset.CurrentPrice)
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

	// SQLC Tip-Güvenli Dönemsel Portföy Değerleri
	if len(holdings) > 0 && totalPortfolioValue > 0 {
		pv, err := cfg.DB.GetPortfolioPeriodValues(r.Context(), userID)
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
