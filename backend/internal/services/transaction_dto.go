package services

import (
	"time"
)

type CreateTransactionDTO struct {
	AssetID         int64
	Type            string
	Amount          string
	Price           string
	TransactionDate time.Time
	Commission      string
}

type UpdateTransactionDTO struct {
	Type            string
	Amount          float64
	Price           float64
	TransactionDate time.Time
	Commission      float64
}

type UserHoldingResponse struct {
	AssetID      int64      `json:"asset_id"`
	Symbol       string     `json:"symbol"`
	AssetName    string     `json:"asset_name"`
	AssetType    string     `json:"asset_type"`
	CurrentPrice float64    `json:"current_price"`
	TotalAmount  float64    `json:"total_amount"`
	AverageCost  float64    `json:"average_cost"`
	TotalValue   float64    `json:"total_value"`
	ProfitLoss   float64    `json:"profit_loss"`
	FirstBuyDate *time.Time `json:"first_buy_date"`
}
