package services

import (
	"context"
	"errors"
	"testing"
	"time"
	"yarmak/internal/database"
)

// islemlerOkunamiyor, işlem geçmişi sorgusu hata veren sahte veritabanı; diğer sorgular fakeQuerier'dan gelir.
type islemlerOkunamiyor struct{ *fakeQuerier }

func (islemlerOkunamiyor) GetAllUserTransactions(context.Context, int64) ([]database.Transaction, error) {
	return nil, errors.New("veritabanı hatası")
}

func TestGetUserHoldings(t *testing.T) {
	q := newFakeQuerier(database.Asset{ID: 1, Symbol: "ASELS", CurrentPrice: "120.000000"})
	q.txs = []database.Transaction{histTx(1, 1, "BUY", 10, 100, 0, time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC), 0)}

	// Normalde: 10 lot, ortalama 100, fiyat 120 → kâr 200.
	got, err := (&TransactionService{DB: q}).GetUserHoldings(context.Background(), 101)
	if err != nil || len(got) != 1 || got[0].AverageCost != 100 || got[0].ProfitLoss != 200 {
		t.Fatalf("beklenen ortalama 100, kâr 200; gelen %+v, hata %v", got, err)
	}

	// İşlem geçmişi okunamazsa ortalama 0 ve kâr 1200 gibi yanlış bir sonuç değil, hata dönmeli.
	got, err = (&TransactionService{DB: islemlerOkunamiyor{q}}).GetUserHoldings(context.Background(), 101)
	if err == nil {
		t.Errorf("hata bekleniyordu, sessizce sonuç döndü: %+v", got)
	}
}
