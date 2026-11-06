package scraper

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"yarmak/internal/database"
)

// sahteSync, quickSyncFn'i verilen sürede biten ve çağrıları sayan sahte işle değiştirir.
func sahteSync(t *testing.T, sure time.Duration) (calls *atomic.Int32, maxParallel *atomic.Int32) {
	t.Helper()
	calls, maxParallel = &atomic.Int32{}, &atomic.Int32{}
	var running atomic.Int32
	eski := quickSyncFn
	quickSyncFn = func(ctx context.Context, db *database.Queries, asset database.Asset) error {
		calls.Add(1)
		n := running.Add(1)
		for {
			m := maxParallel.Load()
			if n <= m || maxParallel.CompareAndSwap(m, n) {
				break
			}
		}
		time.Sleep(sure)
		running.Add(-1)
		return nil
	}
	t.Cleanup(func() { quickSyncFn = eski })
	return calls, maxParallel
}

func TestQuickSyncGuardedSameAssetRunsOnce(t *testing.T) {
	calls, _ := sahteSync(t, 100*time.Millisecond)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Go(func() {
			if err := QuickSyncGuarded(nil, database.Asset{ID: 63, Symbol: "AFT"}, time.Second); err != nil {
				t.Errorf("hata beklenmiyordu: %v", err)
			}
		})
	}
	wg.Wait()
	if n := calls.Load(); n != 1 {
		t.Errorf("aynı fon için 50 istekte 1 senkronizasyon bekleniyordu, %d", n)
	}
}

func TestQuickSyncGuardedLimitsParallelism(t *testing.T) {
	calls, maxParallel := sahteSync(t, 100*time.Millisecond)

	var wg sync.WaitGroup
	for i := int64(1); i <= 5; i++ {
		wg.Go(func() {
			_ = QuickSyncGuarded(nil, database.Asset{ID: i}, 2*time.Second)
		})
	}
	wg.Wait()
	if calls.Load() != 5 {
		t.Errorf("5 farklı varlık için 5 senkronizasyon bekleniyordu, %d", calls.Load())
	}
	if m := maxParallel.Load(); m > 2 {
		t.Errorf("aynı anda en fazla 2 senkronizasyon olmalı, %d oldu", m)
	}
}

func TestQuickSyncGuardedStopsWaiting(t *testing.T) {
	calls, _ := sahteSync(t, 500*time.Millisecond)

	start := time.Now()
	err := QuickSyncGuarded(nil, database.Asset{ID: 99}, 100*time.Millisecond)
	if !errors.Is(err, ErrQuickSyncPending) {
		t.Errorf("süre dolunca ErrQuickSyncPending bekleniyordu, gelen: %v", err)
	}
	if el := time.Since(start); el > 300*time.Millisecond {
		t.Errorf("çağıran ~100 ms sonra bırakmalıydı, %v bekledi", el)
	}
	// İş arka planda bitmeli
	time.Sleep(600 * time.Millisecond)
	if calls.Load() != 1 {
		t.Errorf("iş arka planda tamamlanmalıydı, %d çağrı", calls.Load())
	}
}

func TestQuickSyncGuardedRecoversPanic(t *testing.T) {
	eski := quickSyncFn
	quickSyncFn = func(ctx context.Context, db *database.Queries, asset database.Asset) error {
		var p *float64
		_ = *p // nil pointer panic
		return nil
	}
	t.Cleanup(func() { quickSyncFn = eski })

	if err := QuickSyncGuarded(nil, database.Asset{ID: 7}, time.Second); err == nil {
		t.Error("panic hata olarak dönmeliydi")
	}
}
