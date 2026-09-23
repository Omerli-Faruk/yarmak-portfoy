/**
 * Yarmak - Akıllı İstemci Varlık Önbellek Sistemi (Client In-Memory Asset Cache)
 * 
 * Amaç:
 * 1. Portföyüm (Dashboard) ve Varlıklarım (Holdings) sayfaları arasında geçiş yapıldığında
 *    varlıkların periyot özetlerini (1D, 1W, 1M, vb.) tekrar tekrar Yahoo/BIST servislerinden çekmeyip
 *    önbellekten 0ms gecikmeyle (anında) sunarak N+1 istek darboğazını kökten çözer.
 * 2. 3 dakikalık (180s) TTL ile verileri taze tutar.
 * 3. Kullanıcı "Yenile" butonuna bastığında `invalidateAssetCache()` ile önbellek temizlenebilir.
 */

interface CacheEntry {
    data: Record<string, number>;
    timestamp: number;
}

// 3 dakika (180.000 ms) TTL
const CACHE_TTL_MS = 3 * 60 * 1000;

const summaryCache = new Map<string, CacheEntry>();

/**
 * Belirli bir sembolün önbellekte geçerli olup olmadığını kontrol eder.
 */
export function getCachedAssetSummary(symbol: string): Record<string, number> | null {
    const s = symbol.toUpperCase().trim();
    const entry = summaryCache.get(s);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        summaryCache.delete(s);
        return null;
    }

    return entry.data;
}

/**
 * Bir sembolün özet verisini önbelleğe kaydeder.
 */
export function setCachedAssetSummary(symbol: string, summary: Record<string, number>): void {
    const s = symbol.toUpperCase().trim();
    summaryCache.set(s, {
        data: summary,
        timestamp: Date.now(),
    });
}

/**
 * Tüm önbelleği veya belirli bir sembolün önbelleğini sıfırlar (Kullanıcı Yenile'ye bastığında)
 */
export function invalidateAssetCache(symbol?: string): void {
    if (symbol) {
        summaryCache.delete(symbol.toUpperCase().trim());
    } else {
        summaryCache.clear();
    }
}

/**
 * Verilen sembol listesi için özet verilerini getirir.
 * Önbellekte olanları anında alır, eksik olanları ise eşzamanlı çekip önbelleğe ekler.
 */
export async function fetchAssetSummariesBulk(
    symbols: string[],
    forceRefresh: boolean = false
): Promise<Record<string, Record<string, number>>> {
    const result: Record<string, Record<string, number>> = {};
    const symbolsToFetch: string[] = [];

    for (const rawSym of symbols) {
        const sym = rawSym.toUpperCase().trim();
        if (!forceRefresh) {
            const cached = getCachedAssetSummary(sym);
            if (cached) {
                result[sym] = cached;
                continue;
            }
        }
        symbolsToFetch.push(sym);
    }

    if (symbolsToFetch.length === 0) {
        return result;
    }

    // Paralel çekim (Aynı anda en fazla 5 paralel istek atarak tarayıcı soketini tıkamaz)
    const BATCH_SIZE = 5;
    for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
        const batch = symbolsToFetch.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(
            batch.map(sym =>
                fetch(`/api/assets/detail?symbol=${encodeURIComponent(sym)}&range=1D`)
                    .then(res => (res.ok ? res.json() : null))
                    .then(det => (det?.summary ? { symbol: sym, summary: det.summary } : null))
                    .catch(() => null)
            )
        );

        for (const item of settled) {
            if (item.status === 'fulfilled' && item.value) {
                const { symbol, summary } = item.value;
                setCachedAssetSummary(symbol, summary);
                result[symbol] = summary;
            }
        }
    }

    return result;
}
