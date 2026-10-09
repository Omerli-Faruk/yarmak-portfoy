package handlers

import "time"

// authRequest Hem Register hem de Login için ortak istek gövdesi
type authRequest struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"Secret1234"`
	Username string `json:"username" example:"John"`
}

type userResponse struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	Role      string    `json:"role"`
}

// loginResponse, giriş yanıtı. Tokenlar yalnızca HttpOnly çerezle gönderilir, gövdeye yazılmaz.
type loginResponse struct {
	User userResponse `json:"user"`
}

// Varlıklar
type createAssetRequest struct {
	Symbol    string `json:"symbol" example:"THYAO"`
	Name      string `json:"name" example:"Türk Hava Yolları"`
	AssetType string `json:"asset_type" example:"HISSE" enums:"HISSE,FON,ALTIN,DOVIZ"`
}

// İşlemler ve portföy
type createTransactionRequest struct {
	AssetID         int64     `json:"asset_id" example:"1"`
	Type            string    `json:"type" example:"BUY" enums:"BUY,SELL"`
	Amount          string    `json:"amount" example:"10.0"`
	Price           string    `json:"price" example:"305.50"`
	TransactionDate time.Time `json:"transaction_date" example:"2026-08-21T12:00:00Z"`
	Symbol          string    `json:"symbol" example:"THYAO"`
	AssetType       string    `json:"asset_type" example:"HISSE" enums:"HISSE,FON,ALTIN,DOVIZ"`
	Commission      string    `json:"commission,omitempty" example:"15.50"`
}

type userHoldingResponse struct {
	AssetID      int64      `json:"asset_id"`
	Symbol       string     `json:"symbol"`
	AssetName    string     `json:"asset_name"`
	AssetType    string     `json:"asset_type"`
	CurrentPrice float64    `json:"current_price"`
	TotalAmount  float64    `json:"total_amount"`
	AverageCost  float64    `json:"average_cost"`
	TotalValue   float64    `json:"total_value"`
	ProfitLoss   float64    `json:"profit_loss"`
	FirstBuyDate *time.Time `json:"first_buy_date,omitempty"`
}

type portfolioSummaryResponse struct {
	TotalValue                  float64                          `json:"total_value"`
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

type AssetCategorySummary struct {
	Value      float64 `json:"value"`
	Cost       float64 `json:"cost"`
	ProfitLoss float64 `json:"profit_loss"`
}

// Temettü
type createDividendRequest struct {
	AssetID        int64     `json:"asset_id" example:"1"`
	Amount         string    `json:"amount" example:"500.00"`
	PaymentDate    time.Time `json:"payment_date" example:"2026-08-21T12:00:00Z"`
	AmountPerShare string    `json:"amount_per_share" example:"5.0"`
	IsNet          bool      `json:"is_net,omitempty" example:"false"`
	TaxRate        string    `json:"tax_rate,omitempty" example:"0.15"` // Stopaj oranı (0.15 ya da 15). Boşsa yeni kayıtta %15, güncellemede kaydın mevcut oranı kullanılır.
}

// Bölünme
type createSplitRequest struct {
	AssetID    int64     `json:"asset_id" example:"1"`
	SplitRatio string    `json:"split_ratio" example:"4.000000"`
	SplitDate  time.Time `json:"split_date" example:"2026-08-21T00:00:00Z"`
}

// Fiyat alarmı
type createPriceAlertRequest struct {
	AssetID     int64  `json:"asset_id" example:"1"`
	Symbol      string `json:"symbol,omitempty" example:"THYAO"`
	TargetPrice string `json:"target_price" example:"350.00"`
	Direction   string `json:"direction" example:"ABOVE" enums:"ABOVE,BELOW"`
}
