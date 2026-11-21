package handlers

import "testing"

// #10: geçmişi dönemin başına uzanmayan varlıkta o dönem cevapta olmamalı; %0 "değişmedi" demek olur.
func TestPeriodReturnsOmitsPeriodsWithoutBasePrice(t *testing.T) {
	got := periodReturns(110, map[string]float64{
		"1Y":  100, // 1 yıl önce 100 → %10
		"3Y":  0,   // geçmiş 3 yıla uzanmıyor
		"ALL": 50,  // ilk kayıt 50 → %120
	})

	if r, ok := got["1Y"]; !ok || r < 9.99 || r > 10.01 {
		t.Errorf("1Y = %v (var mı: %v), beklenen %%10", r, ok)
	}
	if r, ok := got["ALL"]; !ok || r < 119.99 || r > 120.01 {
		t.Errorf("ALL = %v (var mı: %v), beklenen %%120", r, ok)
	}
	if r, ok := got["3Y"]; ok {
		t.Errorf("3Y için veri yok, cevapta olmamalıydı; gelen %v", r)
	}
}

func TestPeriodReturnsEmptyWithoutCurrentPrice(t *testing.T) {
	if got := periodReturns(0, map[string]float64{"1Y": 100}); len(got) != 0 {
		t.Errorf("güncel fiyat yokken getiri hesaplanmamalı, gelen %v", got)
	}
}
