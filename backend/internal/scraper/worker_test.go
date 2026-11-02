package scraper

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"testing"
	"yarmak/internal/database"
)

// sahteAlarmDB, checkAndTriggerAlerts'in kullandığı iki sorguyu bellekte taklit eder.
// Gömülü Querier sayesinde diğer sorguları yazmamız gerekmiyor; biri çağrılırsa test panikler.
type sahteAlarmDB struct {
	database.Querier
	alarmlar   []database.PriceAlert
	hataliID   int64
	tetiklenen []int64
}

func (s *sahteAlarmDB) GetPendingAlertsForAsset(ctx context.Context, assetID int64) ([]database.PriceAlert, error) {
	return s.alarmlar, nil
}

func (s *sahteAlarmDB) MarkAlertTriggered(ctx context.Context, id int64) error {
	if id == s.hataliID {
		return errors.New("veritabanı hatası")
	}
	s.tetiklenen = append(s.tetiklenen, id)
	return nil
}

func TestCheckAndTriggerAlerts(t *testing.T) {
	alarmlar := []database.PriceAlert{
		{ID: 1, Direction: "ABOVE", TargetPrice: "100"}, // A
		{ID: 2, Direction: "BELOW", TargetPrice: "90"},  // B
		{ID: 3, Direction: "ABOVE", TargetPrice: "95"},  // C
	}
	cases := []struct {
		fiyat float64
		want  []int64
	}{
		{95, []int64{3}},
		{89, []int64{2}},
		{100, []int64{1, 3}},
	}
	for _, c := range cases {
		db := &sahteAlarmDB{alarmlar: alarmlar}
		checkAndTriggerAlerts(context.Background(), db, database.Asset{ID: 7, Symbol: "ASELS"}, c.fiyat, "")
		if !slices.Equal(db.tetiklenen, c.want) {
			t.Errorf("fiyat %v: tetiklenen %v, beklenen %v", c.fiyat, db.tetiklenen, c.want)
		}
	}
}

// Bir alarmın durumu güncellenemezse o alarm için "tetiklendi" yazılmamalı, diğer alarmlar yine işlenmeli.
func TestCheckAndTriggerAlertsSkipsFailedUpdate(t *testing.T) {
	var log bytes.Buffer
	eski := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&log, nil)))
	defer slog.SetDefault(eski)

	db := &sahteAlarmDB{
		alarmlar: []database.PriceAlert{
			{ID: 1, Direction: "ABOVE", TargetPrice: "90"},
			{ID: 2, Direction: "ABOVE", TargetPrice: "90"},
			{ID: 3, Direction: "ABOVE", TargetPrice: "90"},
		},
		hataliID: 1,
	}
	checkAndTriggerAlerts(context.Background(), db, database.Asset{ID: 7, Symbol: "ASELS"}, 95, "95")

	if !slices.Equal(db.tetiklenen, []int64{2, 3}) {
		t.Errorf("tetiklenen %v, beklenen [2 3]", db.tetiklenen)
	}
	if n := strings.Count(log.String(), "Fiyat alarmı tetiklendi"); n != 2 {
		t.Errorf("%d kez \"tetiklendi\" yazıldı, 2 bekleniyordu:\n%s", n, log.String())
	}
}
