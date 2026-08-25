package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"math"
	"testing"
)

func TestWeightedAverageCostCalculation(t *testing.T) {
	lot1 := 10.0
	fiyat1 := 100.0

	lot2 := 20.0
	fiyat2 := 130.0

	toplamPara := (lot1 * fiyat1) + (lot2 * fiyat2)
	toplamLot := lot1 + lot2
	ortalamaMaliyet := toplamPara / toplamLot
	beklenenMaliyet := 120.0
	if ortalamaMaliyet != beklenenMaliyet {
		t.Errorf("Ortalama maliyet yanlış hesaplandı! Beklenen: %v, Hesaplanan: %v", beklenenMaliyet, ortalamaMaliyet)
	}
}

func TestStockSplitCalculation(t *testing.T) {
	eskiLot := 100.0
	eskiBirimMaaliyet := 200.0
	bölünmeOranı := 4.0
	yeniLot := eskiLot * bölünmeOranı
	yeniBirimMaaliyet := eskiBirimMaaliyet / bölünmeOranı
	if yeniLot != 400.0 || yeniBirimMaaliyet != 50.0 || (eskiLot*eskiBirimMaaliyet) != (yeniBirimMaaliyet*yeniLot) {
		t.Errorf("Bölünme hesaplamasında hata var!")
	}
}

func TestGoldMultiplierCalculation(t *testing.T) {
	gramAltin := 5000.0
	altinS1 := gramAltin * 0.01
	ceyrekAltin := gramAltin * 1.6078
	cumhuriyetAltin := gramAltin * 6.6146
	if math.Abs(altinS1-50.0) > 0.001 {
		t.Errorf("ALTINS1 fiyatı yanlış! Beklenen: 50, Gelen: %v", altinS1)
	}
	if math.Abs(ceyrekAltin-8039.0) > 0.001 {
		t.Errorf("Çeyrek altın fiyatı yanlış! Beklenen: 8039, Gelen: %v", ceyrekAltin)
	}
	if math.Abs(cumhuriyetAltin-33073.0) > 0.001 {
		t.Errorf("Cumhuriyet altını fiyatı yanlış! Beklenen: 33073, Gelen: %v", cumhuriyetAltin)
	}
}

func TestRoundFloat(t *testing.T) {
	val := 1250.336789
	rounded := round2(val)
	if rounded != 1250.34 {
		t.Errorf("Yuvarlama hatalı! Beklenen: 1250.34, Gelen: %v", rounded)
	}
}

func TestCalculateAssetHoldingAndCost(t *testing.T) {
	txs := []database.Transaction{
		{Type: "BUY", Amount: "100.000000", Price: "10.000000", Commission: "0.000000"},
		{Type: "BUY", Amount: "100.000000", Price: "20.000000", Commission: "0.000000"},
		{Type: "SELL", Amount: "150.000000", Price: "25.000000", Commission: "0.000000"},
		{Type: "BUY", Amount: "50.000000", Price: "40.000000", Commission: "0.000000"},
	}

	lot, cost := calculateAssetHoldingAndCost(txs)

	if lot != 100.0 {
		t.Errorf("Beklenen lot 100.0, gelen: %v", lot)
	}

	if math.Abs(cost-27.50) > 0.001 {
		t.Errorf("Beklenen ortalama maliyet 27.50, gelen: %v", cost)
	}
}

func TestParseAverageCost(t *testing.T) {
	cost1 := parseAverageCost("125.500000")
	if cost1 != 125.50 {
		t.Errorf("String dönüşümü hatalı: %v", cost1)
	}
	cost2 := parseAverageCost([]byte("125.500000"))
	if cost2 != 125.50 {
		t.Errorf("Byte slice dönüşümü hatalı: %v", cost2)
	}
}
