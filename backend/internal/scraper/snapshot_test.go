package scraper

import (
	"context"
	"errors"
	"strings"
	"testing"
	"yarmak/internal/database"
)

// sahteOzetDB, snapshotUser'ın kullandığı üç sorguyu taklit eder.
// Gömülü Querier sayesinde diğer sorgular yazılmadı; biri çağrılırsa test panikler.
type sahteOzetDB struct {
	database.Querier
	varliklar []database.GetUserHoldingsSummaryRow
	islemler  []database.Transaction
	islemHata error
	yazilan   []database.UpsertPortfolioSnapshotParams
}

func (s *sahteOzetDB) GetUserHoldingsSummary(ctx context.Context, userID int64) ([]database.GetUserHoldingsSummaryRow, error) {
	return s.varliklar, nil
}

func (s *sahteOzetDB) GetUserTransactionsForAsset(ctx context.Context, arg database.GetUserTransactionsForAssetParams) ([]database.Transaction, error) {
	return s.islemler, s.islemHata
}

func (s *sahteOzetDB) UpsertPortfolioSnapshot(ctx context.Context, arg database.UpsertPortfolioSnapshotParams) error {
	s.yazilan = append(s.yazilan, arg)
	return nil
}

func thyao10Lot() *sahteOzetDB {
	return &sahteOzetDB{
		varliklar: []database.GetUserHoldingsSummaryRow{
			{AssetID: 1, Symbol: "THYAO", CurrentPrice: "110", TotalAmount: "10"},
		},
		islemler: []database.Transaction{
			{Type: "BUY", Amount: "10", Price: "100", Commission: "0"},
		},
	}
}

func TestSnapshotUserDogruDegerleriYazar(t *testing.T) {
	db := thyao10Lot()
	if err := snapshotUser(context.Background(), db, 9); err != nil {
		t.Fatal(err)
	}
	if len(db.yazilan) != 1 {
		t.Fatalf("1 satır bekleniyordu, %d", len(db.yazilan))
	}
	got := db.yazilan[0]
	if got.UserID != 9 || got.TotalValue != "1100.000000" || got.TotalCost != "1000.000000" || got.ProfitLoss != "100.000000" {
		t.Errorf("değer 1100, maliyet 1000, kâr 100 bekleniyordu: %+v", got)
	}
}

// #28: işlemler okunamazsa maliyet 0 sayılıp kalıcı yanlış satır yazılıyordu (kâr = portföyün tamamı).
func TestSnapshotUserIslemOkunamazsaYazmaz(t *testing.T) {
	db := thyao10Lot()
	db.islemHata = errors.New("bağlantı koptu")

	err := snapshotUser(context.Background(), db, 9)
	if err == nil {
		t.Fatal("hata bekleniyordu")
	}
	if !errors.Is(err, db.islemHata) || !strings.Contains(err.Error(), "THYAO") {
		t.Errorf("hata sarmalanmalı ve sembolü söylemeli, gelen: %v", err)
	}
	if len(db.yazilan) != 0 {
		t.Errorf("yanlış satır yazılmamalı, %d satır yazıldı: %+v", len(db.yazilan), db.yazilan)
	}
}

func TestSnapshotUserBosPortfoyYazmaz(t *testing.T) {
	db := &sahteOzetDB{}
	if err := snapshotUser(context.Background(), db, 9); err != nil {
		t.Fatal(err)
	}
	if len(db.yazilan) != 0 {
		t.Errorf("boş portföy için satır yazılmamalı")
	}
}

// #31: işçi turunda panic olursa süreç düşmemeli.
func TestRunSafelyPanigiYakalar(t *testing.T) {
	calisti := false
	runSafely("test", func() {
		calisti = true
		var p *float64
		_ = *p
	})
	if !calisti {
		t.Error("fonksiyon çalışmalıydı")
	}
}
