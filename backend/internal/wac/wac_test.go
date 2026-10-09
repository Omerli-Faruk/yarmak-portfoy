package wac

import (
	"math"
	"testing"
	"yarmak/internal/database"
)

func TestHoldingAndCost(t *testing.T) {
	txs := []database.Transaction{
		{Type: "BUY", Amount: "100.000000", Price: "10.000000", Commission: "0.000000"},
		{Type: "BUY", Amount: "100.000000", Price: "20.000000", Commission: "0.000000"},
		{Type: "SELL", Amount: "150.000000", Price: "25.000000", Commission: "0.000000"},
		{Type: "BUY", Amount: "50.000000", Price: "40.000000", Commission: "0.000000"},
	}

	lot, cost := HoldingAndCost(txs)

	if lot != 100.0 {
		t.Errorf("Beklenen lot 100.0, gelen: %v", lot)
	}

	if math.Abs(cost-27.50) > 0.001 {
		t.Errorf("Beklenen ortalama maliyet 27.50, gelen: %v", cost)
	}
}
