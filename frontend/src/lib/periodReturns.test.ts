// Çalıştırma: npm run test:periods  (Node'un kendi test koşucusu)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodReturnsFromPoints, priceAtOrBefore, type PricePoint } from './periodReturns.ts';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 20, 7); // 20 Kasım 2026

// Her gün bir fiyat: start günden bugüne, fiyat = gün sırası + 1
function daily(daysBack: number): PricePoint[] {
    const pts: PricePoint[] = [];
    for (let d = daysBack; d >= 0; d--) pts.push({ time: now - d * DAY, price: daysBack - d + 1 });
    return pts;
}

test('#10: 1 yıllık geçmişte 3Y ve 5Y yok, 1Y var', () => {
    const pts = daily(365);
    const current = pts[pts.length - 1].price; // 366
    const r = periodReturnsFromPoints(current, pts, now);
    assert.ok('1Y' in r, '1Y olmalı');
    assert.equal(Math.round(r['1Y']), 36500); // 1 → 366
    assert.ok(!('3Y' in r), `3Y olmamalı, gelen ${r['3Y']}`);
    assert.ok(!('5Y' in r), `5Y olmamalı, gelen ${r['5Y']}`);
});

test('dönem başı fiyatı: hedefteki ya da önceki SON fiyat (sonraki ilk değil)', () => {
    // 10 gün önce 100, 5 gün önce 200, bugün 300: 1H tabanı 10 gün önceki 100 olmalı (eskiden 5 gün önceki 200 alınıyordu)
    const pts = [
        { time: now - 10 * DAY, price: 100 },
        { time: now - 5 * DAY, price: 200 },
        { time: now, price: 300 },
    ];
    assert.equal(priceAtOrBefore(pts, now - 7 * DAY), 100);
    assert.equal(periodReturnsFromPoints(300, pts, now)['1W'], 200);
});

test('5 yıllık geçmiş tatile denk gelip 2 gün geç başlarsa 5Y yine hesaplanır; 1H\'de tolerans yok', () => {
    const fiveY = now - 5 * 365 * DAY;
    const pts = [{ time: fiveY + 2 * DAY, price: 50 }, { time: now, price: 100 }];
    assert.equal(periodReturnsFromPoints(100, pts, now)['5Y'], 100);

    const kisa = [{ time: now - 3 * DAY, price: 50 }, { time: now, price: 100 }];
    assert.ok(!('1W' in periodReturnsFromPoints(100, kisa, now)), '3 günlük geçmişte 1H olmamalı');
});

test('YBB tabanı yılbaşından önceki son kapanış', () => {
    const pts = [
        { time: Date.UTC(2025, 11, 31, 12), price: 80 },
        { time: Date.UTC(2026, 0, 2, 12), price: 90 },
        { time: now, price: 120 },
    ];
    assert.equal(periodReturnsFromPoints(120, pts, now)['YTD'], 50);
});
