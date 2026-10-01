package services

import (
	"context"
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
	DB *database.Queries
}

func NewTransactionService(db *database.Queries) *TransactionService {
	return &TransactionService{DB: db}
}

func (s *TransactionService) RecalculateAssetRealizedPnL(ctx context.Context, userID, assetID int64) error {
	if s.DB == nil {
		return nil
	}
	userTxs, err := s.DB.GetUserTransactionsForAsset(ctx, database.GetUserTransactionsForAssetParams{
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
				_ = s.DB.UpdateTransactionRealizedPnL(ctx, database.UpdateTransactionRealizedPnLParams{
					RealizedPnl: cleanPnL,
					ID:          tx.ID,
					UserID:      userID,
				})
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
