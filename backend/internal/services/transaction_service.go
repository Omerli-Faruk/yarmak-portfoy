package services

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"sync"
	"yarmak/internal/database"
)

type userLock struct {
	sync.Mutex
	count int
}

var (
	globalMu  sync.Mutex
	userLocks = make(map[int64]*userLock)
)

func LockUser(userID int64) func() {
	globalMu.Lock()
	mu, exists := userLocks[userID]
	if !exists {
		mu = &userLock{}
		userLocks[userID] = mu
	}
	mu.count++
	globalMu.Unlock()
	mu.Lock()
	return func() {
		globalMu.Lock()
		mu.count--
		if mu.count == 0 {
			delete(userLocks, userID)
		}
		globalMu.Unlock()
		mu.Unlock()
	}
}

type TransactionService struct {
	DB   *database.Queries
	Conn *sql.DB
}

func NewTransactionService(db *database.Queries, conn *sql.DB) *TransactionService {
	return &TransactionService{DB: db, Conn: conn}
}

// inTx, verilen işi tek bir veritabanı transaction'ı içinde çalıştırır; hata olursa hepsi geri alınır.
func (s *TransactionService) inTx(ctx context.Context, fn func(q *database.Queries) error) error {
	tx, err := s.Conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("veritabanı işlemi başlatılamadı: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(s.DB.WithTx(tx)); err != nil {
		// Sarmadan dönüyoruz; handler hata metnine bakarak 400/500 ayrımı yapıyor.
		return err
	}
	return tx.Commit()
}

// recalculateRealizedPnL, varlığın tüm satışlarının gerçekleşen kâr/zararını baştan hesaplar.
// Alım, satım, düzenleme ve silme ile aynı transaction içinde çağrılır.
func recalculateRealizedPnL(ctx context.Context, q *database.Queries, userID, assetID int64) error {
	userTxs, err := q.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
		UserID:  userID,
		AssetID: assetID,
	})
	if err != nil {
		return err
	}

	runningLot := 0.0
	runningCost := 0.0

	for _, tx := range userTxs {
		amount, _ := strconv.ParseFloat(tx.Amount, 64)
		price, _ := strconv.ParseFloat(tx.Price, 64)
		commission, _ := strconv.ParseFloat(tx.Commission, 64)

		if tx.Type == "BUY" {
			total := (amount * price) + commission
			if (runningLot + amount) > 0 {
				runningCost = (runningLot*runningCost + total) / (runningLot + amount)
			}
			runningLot += amount
		} else if tx.Type == "SELL" {
			pnl := amount*(price-runningCost) - commission
			cleanPnL := fmt.Sprintf("%.6f", pnl)
			if tx.RealizedPnl != cleanPnL {
				err := q.UpdateTransactionRealizedPnL(ctx, database.UpdateTransactionRealizedPnLParams{
					RealizedPnl: cleanPnL,
					ID:          tx.ID,
					UserID:      userID,
				})
				if err != nil {
					return err
				}
			}
			runningLot -= amount
			if runningLot <= 0.000001 {
				runningLot = 0
				runningCost = 0
			}
		}
	}
	return nil
}
