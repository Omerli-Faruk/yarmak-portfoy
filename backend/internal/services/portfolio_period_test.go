package services

import (
	"testing"

	"yarmak/internal/database"
)

// #10: 3 yıl önce fiyatı olmayan varlık 3Y getirisine katılmamalı. Eskiden "değişmedi" sayılıp getiriyi sulandırıyordu;
// hiçbir varlığın fiyatı yoksa dönem hiç yazılmamalı (eskiden %0).
func TestPortfolioPeriodReturnsUsesOnlyAssetsWithHistory(t *testing.T) {
	rows := []database.GetPortfolioPeriodPricesRow{
		{AssetID: 1, Qty: 10, PCur: 150, P1y: 100, P3y: 50}, // eski hisse: 3 yılda 3 kat
		{AssetID: 2, Qty: 100, PCur: 12, P1y: 10},           // 1 yıllık fon: 3 yıl önce fiyatı yok
	}
	returns, values := portfolioPeriodReturns(rows)

	// 1Y: (1500 + 1200) / (1000 + 1000) → %35
	if !near(returns["1Y"], 35) || !near(values["1Y"], 2000) {
		t.Errorf("1Y = %v (dönem başı %v), beklenen %%35 (2000)", returns["1Y"], values["1Y"])
	}
	// 3Y yalnız hisseyle: 1500 / 500 → %200. Fon "değişmedi" sayılsaydı (1500 + 1200) / (500 + 1200) → %58,82 çıkardı.
	if !near(returns["3Y"], 200) {
		t.Errorf("3Y = %v, beklenen %%200 (yalnız geçmişi olan varlık)", returns["3Y"])
	}
	if r, ok := returns["5Y"]; ok {
		t.Errorf("hiçbir varlığın 5 yıl önceki fiyatı yok, 5Y yazılmamalıydı; gelen %v", r)
	}
	if !near(values["CURRENT"], 2700) {
		t.Errorf("CURRENT = %v, beklenen 2700", values["CURRENT"])
	}
}
