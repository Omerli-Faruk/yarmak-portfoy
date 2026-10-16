package scraper

import (
	"testing"
	"time"
)

func TestShouldRunCycle(t *testing.T) {
	trt := time.FixedZone("TRT", 3*60*60)
	// 16 Ekim 2026 Cuma, 17 Cumartesi, 19 Pazartesi
	at := func(day, hour, minute int) time.Time {
		return time.Date(2026, time.October, day, hour, minute, 0, 0, trt)
	}

	tests := []struct {
		name    string
		now     time.Time
		lastRun time.Time
		want    bool
	}{
		{"seans içinde her tik çalışır", at(16, 14, 0), at(16, 13, 55), true},
		{"18:15 hâlâ seans", at(16, 18, 15), at(16, 18, 10), true},
		{"18:20 seans dışı, son tur 5 dk önce", at(16, 18, 20), at(16, 18, 15), false},
		{"seans dışı, son turdan 4 saat geçti", at(16, 22, 15), at(16, 18, 15), true},
		{"seans dışı, son turdan 5 dk geçti", at(16, 22, 20), at(16, 22, 15), false},
		{"cumartesi, son tur 3 sa 40 dk önce", at(17, 14, 0), at(17, 10, 20), false},
		{"cumartesi, son tur 4 sa 5 dk önce", at(17, 14, 25), at(17, 10, 20), true},
		{"pazartesi 09:55 seans öncesi", at(19, 9, 55), at(19, 6, 15), false},
		{"pazartesi 10:00 seans açılışı", at(19, 10, 0), at(19, 9, 55), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldRunCycle(tt.now, tt.lastRun); got != tt.want {
				t.Errorf("shouldRunCycle(%s, %s) = %v, beklenen %v",
					tt.now.Format("Mon 15:04"), tt.lastRun.Format("Mon 15:04"), got, tt.want)
			}
		})
	}
}
