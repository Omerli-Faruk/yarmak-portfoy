package scraper

import (
	"testing"
	"time"
)

var trt = time.FixedZone("TRT", 3*60*60)

// 16 Ekim 2026 Cuma, 17 Cumartesi, 18 Pazar, 19 Pazartesi
func at(day, hour, minute int) time.Time {
	return time.Date(2026, time.October, day, hour, minute, 0, 0, trt)
}

type cycleCase struct {
	name    string
	now     time.Time
	lastRun time.Time
	want    bool
}

func runCycleCases(t *testing.T, isOpen func(time.Time) bool, tests []cycleCase) {
	t.Helper()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldRunCycle(isOpen(tt.now), tt.now, tt.lastRun); got != tt.want {
				t.Errorf("shouldRunCycle(%s, son tur %s) = %v, beklenen %v",
					tt.now.Format("Mon 15:04"), tt.lastRun.Format("Mon 15:04"), got, tt.want)
			}
		})
	}
}

func TestShouldRunCycleStocks(t *testing.T) {
	runCycleCases(t, isBistMarketHours, []cycleCase{
		{"seans içinde her tik çalışır", at(16, 14, 0), at(16, 13, 55), true},
		{"18:15 hâlâ seans", at(16, 18, 15), at(16, 18, 10), true},
		{"18:20 seans dışı, son tur 5 dk önce", at(16, 18, 20), at(16, 18, 15), false},
		{"seans dışı, son turdan 4 saat geçti", at(16, 22, 15), at(16, 18, 15), true},
		{"seans dışı, son turdan 5 dk geçti", at(16, 22, 20), at(16, 22, 15), false},
		{"cumartesi, son tur 3 sa 40 dk önce", at(17, 14, 0), at(17, 10, 20), false},
		{"cumartesi, son tur 4 sa 5 dk önce", at(17, 14, 25), at(17, 10, 20), true},
		{"pazartesi 09:55 seans öncesi", at(19, 9, 55), at(19, 6, 15), false},
		{"pazartesi 10:00 seans açılışı", at(19, 10, 0), at(19, 9, 55), true},
	})
}

func TestShouldRunCycleFx(t *testing.T) {
	runCycleCases(t, isFxMarketOpen, []cycleCase{
		{"hafta içi akşam her tik çalışır", at(16, 20, 0), at(16, 19, 55), true},
		{"hafta içi gece her tik çalışır", at(16, 23, 55), at(16, 23, 50), true},
		{"cumartesi gece yarısı, son tur 10 dk önce", at(17, 0, 5), at(16, 23, 55), false},
		{"cumartesi, son tur 3 sa 40 dk önce", at(17, 14, 0), at(17, 10, 20), false},
		{"pazar, son tur 4 saat önce", at(18, 14, 0), at(18, 10, 0), true},
		{"pazartesi gece yarısı açılış", at(19, 0, 0), at(18, 23, 55), true},
	})
}

func TestIsFxAsset(t *testing.T) {
	for assetType, want := range map[string]bool{"DOVIZ": true, "ALTIN": true, "HISSE": false, "FON": false} {
		if got := isFxAsset(assetType); got != want {
			t.Errorf("isFxAsset(%q) = %v, beklenen %v", assetType, got, want)
		}
	}
}
