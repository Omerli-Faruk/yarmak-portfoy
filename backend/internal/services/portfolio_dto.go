package services

type AssetCategorySummary struct {
	Value      float64 `json:"value"`
	Cost       float64 `json:"cost"`
	ProfitLoss float64 `json:"profit_loss"`
}

type PortfolioSummaryResult struct {
	TotalValue                  float64                          `json:"total_value"`
	TotalEquityValue            float64                          `json:"total_equity_value"`
	TotalCost                   float64                          `json:"total_cost"`
	CapitalProfitLoss           float64                          `json:"capital_profit_loss"`
	CapitalProfitLossPercentage float64                          `json:"capital_profit_loss_percentage"`
	RealizedProfitLoss          float64                          `json:"realized_profit_loss"`
	TotalDividends              float64                          `json:"total_dividends"`
	TotalCombinedProfit         float64                          `json:"total_combined_profit"`
	TotalReturnPercentage       float64                          `json:"total_return_percentage"`
	HoldingsCount               int                              `json:"holdings_count"`
	Breakdown                   map[string]*AssetCategorySummary `json:"breakdown"`
	USDRate                     float64                          `json:"usd_rate"`
	TotalValueUSD               float64                          `json:"total_value_usd"`
	TotalCombinedProfitUSD      float64                          `json:"total_combined_profit_usd"`
	TotalCommission             float64                          `json:"total_commission"`
	PeriodReturns               map[string]float64               `json:"period_returns,omitempty"`
	PeriodValues                map[string]float64               `json:"period_values,omitempty"`
}
