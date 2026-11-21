// Dönem getirileri (1H, 1A ... 5Y) için ortak hesap. Hisse (Yahoo), altın ve varlık detayı aynı kuralı kullanır.
//
// Dönem başı fiyatı: hedef tarihteki ya da öncesindeki SON fiyat. Eskiden hedeften SONRAKİ ilk fiyat alınıyordu;
// geçmişi 1 yıl olan varlıkta "5Y getirisi" aslında 1 yıllık getiriydi ve fiyatı hiç olmayan dönem %0 görünüyordu (#10).
// Artık geçmiş o tarihe uzanmıyorsa dönem sonuçta hiç yer almaz; arayüz o dönemi göstermez.

export interface PricePoint {
    time: number; // ms
    price: number;
}

const DAY = 86_400_000;

// YBB, 1Y, 3Y, 5Y'de hedeften sonraki 7 gün içindeki ilk fiyat da kabul edilir: 5 yıllık Yahoo verisi tam 5 yıl
// önce tatile denk gelen bir günde başlıyorsa 5Y kaybolmasın. Kısa dönemlerde (1H, 1A) bu tolerans yanlış etiket olurdu.
const START_TOLERANCE = 7 * DAY;

/**
 * points zamana göre artan sırada olmalı. strict: hedefin kendisi hariç (YBB: yılbaşından ÖNCEKİ son kapanış).
 * Fiyat bulunamazsa undefined.
 */
export function priceAtOrBefore(points: PricePoint[], target: number, opts: { strict?: boolean; tolerance?: boolean } = {}): number | undefined {
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        if (opts.strict ? p.time < target : p.time <= target) {
            return p.price > 0 ? p.price : undefined;
        }
    }
    // Hedeften önce hiç fiyat yok: geçmiş bu kadar eskiye uzanmıyor
    if (opts.tolerance && points.length > 0 && points[0].time - target <= START_TOLERANCE && points[0].price > 0) {
        return points[0].price;
    }
    return undefined;
}

function pct(current: number, base: number | undefined): number | undefined {
    if (base === undefined || base <= 0 || !(current > 0)) return undefined;
    return ((current - base) / base) * 100;
}

/**
 * 1H, 1A, 3A, 6A, YBB, 1Y, 3Y, 5Y getirileri. now: son fiyatın zamanı. Verisi olmayan dönem sonuçta yer almaz.
 * 1G ve Tümü çağıranın işi (kaynağa göre farklı hesaplanıyor).
 */
export function periodReturnsFromPoints(current: number, points: PricePoint[], now: number): Record<string, number> {
    const startOfYear = new Date(new Date(now).getFullYear(), 0, 1).getTime();
    const periods: [string, number | undefined][] = [
        ['1W', pct(current, priceAtOrBefore(points, now - 7 * DAY))],
        ['1M', pct(current, priceAtOrBefore(points, now - 30 * DAY))],
        ['3M', pct(current, priceAtOrBefore(points, now - 90 * DAY))],
        ['6M', pct(current, priceAtOrBefore(points, now - 180 * DAY))],
        ['YTD', pct(current, priceAtOrBefore(points, startOfYear, { strict: true, tolerance: true }))],
        ['1Y', pct(current, priceAtOrBefore(points, now - 365 * DAY, { tolerance: true }))],
        ['3Y', pct(current, priceAtOrBefore(points, now - 3 * 365 * DAY, { tolerance: true }))],
        ['5Y', pct(current, priceAtOrBefore(points, now - 5 * 365 * DAY, { tolerance: true }))],
    ];
    const out: Record<string, number> = {};
    for (const [key, value] of periods) {
        if (value !== undefined && isFinite(value)) out[key] = value;
    }
    return out;
}
