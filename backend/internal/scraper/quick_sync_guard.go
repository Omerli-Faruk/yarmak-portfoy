package scraper

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"golang.org/x/sync/singleflight"

	"yarmak/internal/database"
)

// ErrQuickSyncBusy, senkronizasyon sırası doluyken verilen sürede yer açılmadığını bildirir.
var ErrQuickSyncBusy = errors.New("hızlı senkronizasyon sırası dolu")

// ErrQuickSyncPending, iş verilen sürede bitmediği için beklemenin bırakıldığını bildirir; iş arka planda sürer.
var ErrQuickSyncPending = errors.New("hızlı senkronizasyon arka planda sürüyor")

var (
	quickSyncGroup singleflight.Group
	// TEFAS'ın engelleyicisi sıkı; kullanıcı isteğiyle tetiklenen senkronizasyondan aynı anda en fazla 2 tane.
	quickSyncSlots = make(chan struct{}, 2)
	// Testler ağa çıkmadan sahte bir iş verebilsin diye değişken.
	quickSyncFn = QuickSyncAsset
)

// QuickSyncGuarded, QuickSyncAsset'i kullanıcı isteklerine karşı korur:
// aynı varlık için aynı anda tek çalışma (50 kişi aynı boş fonu açarsa dışarıya 1 istek),
// genel olarak aynı anda en fazla 2 çalışma, ve çağıran en fazla maxWait bekler.
// Süre dolarsa ErrQuickSyncPending döner ama iş arka planda bitip veritabanına yazar.
func QuickSyncGuarded(db *database.Queries, asset database.Asset, maxWait time.Duration) error {
	deadline := time.NewTimer(maxWait)
	defer deadline.Stop()

	ch := quickSyncGroup.DoChan(strconv.FormatInt(asset.ID, 10), func() (result any, err error) {
		// Bu iş isteğin goroutine'inden ayrı çalışıyor; panic sunucuyu düşürmesin.
		defer func() {
			if r := recover(); r != nil {
				slog.Error("Hızlı senkronizasyonda panic yakalandı", "symbol", asset.Symbol, "panic", r)
				err = fmt.Errorf("hızlı senkronizasyon panic: %v", r)
			}
		}()

		select {
		case quickSyncSlots <- struct{}{}:
		case <-time.After(maxWait):
			return nil, ErrQuickSyncBusy
		}
		defer func() { <-quickSyncSlots }()

		// İsteğin context'i değil: çağıran beklemeyi bıraksa da iş bitsin.
		return nil, quickSyncFn(context.Background(), db, asset)
	})

	select {
	case res := <-ch:
		return res.Err
	case <-deadline.C:
		return ErrQuickSyncPending
	}
}
