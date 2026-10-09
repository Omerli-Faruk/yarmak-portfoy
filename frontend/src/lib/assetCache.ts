// Varlıkların periyot getirilerini (1D, 1W, 1M...) tarayıcı belleğinde 3 dakika tutar.
// Böylece Portföyüm ve Varlıklarım sayfaları arasında geçerken aynı özetler her varlık için
// yeniden istenmez. "Yenile" düğmesi invalidateAssetCache() ile önbelleği temizler.

interface CacheEntry {
    data: Record<string, number>;
    timestamp: number;
}

const CACHE_TTL_MS = 3 * 60 * 1000;

const summaryCache = new Map<string, CacheEntry>();

// Sembolün süresi geçmemiş özetini döner, yoksa null.
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

export function setCachedAssetSummary(symbol: string, summary: Record<string, number>): void {
    const s = symbol.toUpperCase().trim();
    summaryCache.set(s, {
        data: summary,
        timestamp: Date.now(),
    });
}

// Sembol verilirse yalnızca onu, verilmezse tüm önbelleği siler.
export function invalidateAssetCache(symbol?: string): void {
    if (symbol) {
        summaryCache.delete(symbol.toUpperCase().trim());
    } else {
        summaryCache.clear();
    }
}

// Önbellekte olanları oradan alır, eksikleri /api/assets/detail'den çekip önbelleğe yazar.
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

    // Eksik sembollerin özetleri tek istekte toplu endpoint'ten alınır
    try {
        const res = await fetch('/api/assets/batch-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: symbolsToFetch }),
        });

        if (res.ok) {
            const data = await res.json();
            const batchSummaries: Record<string, Record<string, number>> = data.summaries || data;
            for (const sym of symbolsToFetch) {
                if (batchSummaries && batchSummaries[sym]) {
                    setCachedAssetSummary(sym, batchSummaries[sym]);
                    result[sym] = batchSummaries[sym];
                }
            }
        }
    } catch (err) {
        console.warn('Batch summary fetch hatası:', err);
    }

    return result;
}
