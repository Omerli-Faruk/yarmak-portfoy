package services

import (
	"math"
	"testing"
	"time"
)

func TestFirstNegativeLotEvent(t *testing.T) {
	day := func(m time.Month, d int) time.Time { return time.Date(2026, m, d, 12, 0, 0, 0, time.UTC) }
	const newSell = math.MaxInt64

	tests := []struct {
		name    string
		events  []lotEvent
		wantID  int64
		wantNeg bool
	}{
		{
			// Eski kod bu satışı kabul ediyordu: 1 Şubat'ta elde sadece 10 lot var.
			name: "geçmiş tarihli satış o günkü bakiyeyi aşıyor",
			events: []lotEvent{
				{ID: 1, Date: day(1, 1), Type: "BUY", Lot: 10},
				{ID: 2, Date: day(3, 1), Type: "BUY", Lot: 100},
				{ID: newSell, Date: day(2, 1), Type: "SELL", Lot: 50},
			},
			wantID:  newSell,
			wantNeg: true,
		},
		{
			name: "geçmiş tarihli satış sonraki satışı eksiye düşürüyor",
			events: []lotEvent{
				{ID: 1, Date: day(1, 1), Type: "BUY", Lot: 100},
				{ID: 2, Date: day(3, 1), Type: "SELL", Lot: 100},
				{ID: newSell, Date: day(2, 1), Type: "SELL", Lot: 50},
			},
			wantID:  2,
			wantNeg: true,
		},
		{
			// 0.3 - 0.1 - 0.2 float'ta tam sıfır çıkmıyor, tolerans bunu kurtarmalı.
			name: "küsuratlı satışlarda float hatası",
			events: []lotEvent{
				{ID: 1, Date: day(1, 1), Type: "BUY", Lot: 0.3},
				{ID: 2, Date: day(1, 2), Type: "SELL", Lot: 0.1},
				{ID: newSell, Date: day(1, 3), Type: "SELL", Lot: 0.2},
			},
			wantNeg: false,
		},
		{
			name: "aynı anda alım ve satım",
			events: []lotEvent{
				{ID: 5, Date: day(1, 1), Type: "BUY", Lot: 10},
				{ID: newSell, Date: day(1, 1), Type: "SELL", Lot: 10},
			},
			wantNeg: false,
		},
		{
			name: "hiç işlem yokken satış",
			events: []lotEvent{
				{ID: newSell, Date: day(1, 1), Type: "SELL", Lot: 1},
			},
			wantID:  newSell,
			wantNeg: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotID, gotNeg := firstNegativeLotEvent(tt.events)
			if gotNeg != tt.wantNeg {
				t.Fatalf("negatif = %v, beklenen %v", gotNeg, tt.wantNeg)
			}
			if tt.wantNeg && gotID != tt.wantID {
				t.Errorf("ID = %d, beklenen %d", gotID, tt.wantID)
			}
		})
	}
}

func TestFirstNegativeLotEventFrom(t *testing.T) {
	day := func(m time.Month, d int) time.Time { return time.Date(2026, m, d, 12, 0, 0, 0, time.UTC) }
	const newSell = math.MaxInt64

	// Eski kontrolün kabul ettiği bozuk kayıt: 1 Şubat satışı, 1 Mart alımından önce bakiyeyi eksiye düşürüyor.
	stored := []lotEvent{
		{ID: 1, Date: day(3, 1), Type: "BUY", Lot: 100},
		{ID: 2, Date: day(2, 1), Type: "SELL", Lot: 50},
	}

	t.Run("eski kayıttaki eksi bugünkü satışı engellemiyor", func(t *testing.T) {
		events := append(append([]lotEvent{}, stored...), lotEvent{ID: newSell, Date: day(10, 9), Type: "SELL", Lot: 10})
		if id, neg := firstNegativeLotEventFrom(events, newSell); neg {
			t.Fatalf("satış reddedildi (ID %d), kabul edilmeliydi", id)
		}
	})

	t.Run("bugünkü bakiyeyi aşan satış yine reddediliyor", func(t *testing.T) {
		events := append(append([]lotEvent{}, stored...), lotEvent{ID: newSell, Date: day(10, 9), Type: "SELL", Lot: 60})
		id, neg := firstNegativeLotEventFrom(events, newSell)
		if !neg || id != newSell {
			t.Fatalf("sonuç (%d, %v), beklenen (%d, true)", id, neg, int64(newSell))
		}
	})

	t.Run("tüm geçmişe bakan kontrol eski eksiyi görüyor", func(t *testing.T) {
		if id, neg := firstNegativeLotEvent(stored); !neg || id != 2 {
			t.Fatalf("sonuç (%d, %v), beklenen (2, true)", id, neg)
		}
	})
}
