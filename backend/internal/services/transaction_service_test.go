package services

import (
	"context"
	"strings"
	"testing"
	"time"
	"yarmak/internal/database"
)

// newTestTransactionService, transaction'ı sahte veritabanında doğrudan çalıştırır.
// Geri alma yok; doğrulama hataları yazmadan önce döndüğü için testlerde gerek de yok.
func newTestTransactionService(q *fakeQuerier) *TransactionService {
	return &TransactionService{
		DB: q,
		inTx: func(_ context.Context, fn func(database.Querier) error) error {
			return fn(q)
		},
	}
}

func TestCreateTransaction_Validation(t *testing.T) {
	d := func(day int) time.Time { return time.Date(2026, 10, day, 12, 0, 0, 0, time.UTC) }
	existing := []database.Transaction{
		histTx(1, 1, "BUY", 10, 100, 0, d(1), 0),
		histTx(2, 1, "SELL", 8, 110, 0, d(5), 80),
	}
	cases := []struct {
		name    string
		dto     CreateTransactionDTO
		wantErr string
	}{
		{"sıfır miktar", CreateTransactionDTO{AssetID: 1, Type: "BUY", Amount: "0", Price: "10", TransactionDate: d(6)}, "miktarı"},
		{"geçersiz fiyat", CreateTransactionDTO{AssetID: 1, Type: "BUY", Amount: "1", Price: "abc", TransactionDate: d(6)}, "fiyatı"},
		{"elde olandan fazla satış", CreateTransactionDTO{AssetID: 1, Type: "SELL", Amount: "3", Price: "120", TransactionDate: d(6)}, "Yetersiz bakiye"},
		// 3 Ekim'de 5 satılırsa 5 Ekim'deki 8'lik satış eksiye düşer
		{"geçmiş tarihli satış sonrakini bozuyor", CreateTransactionDTO{AssetID: 1, Type: "SELL", Amount: "5", Price: "120", TransactionDate: d(3)}, "Geçmiş tarihli"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			q := newFakeQuerier()
			q.txs = append([]database.Transaction(nil), existing...)
			_, err := newTestTransactionService(q).CreateTransaction(context.Background(), 1, c.dto)
			if err == nil || !strings.Contains(err.Error(), c.wantErr) {
				t.Fatalf("hata %q içermeli, gelen: %v", c.wantErr, err)
			}
			if len(q.txs) != len(existing) {
				t.Fatalf("hatalı işlem kaydedilmemeli: %d kayıt var", len(q.txs))
			}
		})
	}
}

// Geçerli satış kaydedilir ve gerçekleşen kâr aynı transaction içinde hesaplanır.
func TestCreateTransaction_SellRecalculatesRealized(t *testing.T) {
	q := newFakeQuerier()
	q.txs = []database.Transaction{histTx(1, 1, "BUY", 10, 100, 0, time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC), 0)}
	s := newTestTransactionService(q)

	created, err := s.CreateTransaction(context.Background(), 1, CreateTransactionDTO{
		AssetID: 1, Type: "SELL", Amount: "4", Price: "150", Commission: "2",
		TransactionDate: time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Amount != "4.000000" || created.Price != "150.000000" || created.Commission != "2.000000" {
		t.Fatalf("kayıt yanlış biçimlendi: %+v", created)
	}
	stored := q.txs[len(q.txs)-1]
	// 4 × (150 - 100) - 2
	if stored.RealizedPnl != "198.000000" {
		t.Fatalf("gerçekleşen kâr 198 olmalı, gelen %s", stored.RealizedPnl)
	}
}

// Bölünmeden önceki tarihli alım, bölünme oranına göre lot ve fiyat olarak düzeltilir.
func TestCreateTransaction_AppliesLaterSplit(t *testing.T) {
	q := newFakeQuerier()
	q.splits[1] = []database.Split{{ID: 1, AssetID: 1, SplitRatio: "2", SplitDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)}}
	created, err := newTestTransactionService(q).CreateTransaction(context.Background(), 1, CreateTransactionDTO{
		AssetID: 1, Type: "BUY", Amount: "10", Price: "100",
		TransactionDate: time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Amount != "20.000000" || created.Price != "50.000000" {
		t.Fatalf("bölünme uygulanmalı (20 lot × 50): %+v", created)
	}
}
