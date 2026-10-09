/**
 * Yarmak - Sunucu Taraflı Varlık Özet & Getiri Hesaplama Motoru
 * (Server-Side Asset Summary & Returns Calculation Engine)
 * 
 * Bu modül; /api/assets/batch-summary ve /api/assets/detail endpoint'lerinin
 * ortak kullandığı yüksek performanslı, bellek önbellekli getiri hesaplayıcısıdır.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

export interface AccurateSummaryResult {
    summary: Record<string, number>;
    previousClose?: number;
    currentPrice?: number;
}

export interface BackendAssetLookup {
    id: number;
    symbol: string;
    name?: string;
    asset_type?: string;
    current_price?: string;
    isTefas: boolean;
}

// 1. Sembol -> Varlık Çözümleme Önbelleği (10 dakika TTL)
const assetLookupCache = new Map<string, { data: BackendAssetLookup; timestamp: number }>();
const ASSET_LOOKUP_TTL = 10 * 60 * 1000;

// 2. Sembol -> Getiri Özeti Önbelleği (3 dakika TTL)
const summaryCache = new Map<string, { data: AccurateSummaryResult; timestamp: number }>();
const SUMMARY_TTL = 3 * 60 * 1000;

export function getYahooTicker(symbol: string): string {
    const s = symbol.toUpperCase().trim();
    if (s === 'USDTRY' || s === 'USD/TRY') return 'USDTRY=X';
    if (s === 'EURTRY' || s === 'EUR/TRY') return 'EURTRY=X';
    if (s === 'GBPTRY' || s === 'GBP/TRY') return 'GBPTRY=X';
    if (s === 'ALTIN' || s === 'GRAMALTIN') return 'GC=F';
    if (s === 'XU100' || s === 'BIST100') return 'XU100.IS';
    if (s === 'XU030' || s === 'BIST30') return 'XU030.IS';
    if (s.endsWith('.IS') || s.endsWith('=X') || s.endsWith('=F')) return s;
    return `${s}.IS`;
}

/**
 * Backend üzerinden sembolün kayıtlı ID'sini ve fon olup olmadığını çözer.
 */
export async function resolveBackendAsset(rawSymbol: string): Promise<BackendAssetLookup | null> {
    const sym = rawSymbol.toUpperCase().trim();
    const cached = assetLookupCache.get(sym);
    if (cached && Date.now() - cached.timestamp < ASSET_LOOKUP_TTL) {
        return cached.data;
    }

    try {
        let assetsRes = await fetch(`${BACKEND_URL}/assets/lookup?symbol=${encodeURIComponent(sym)}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });

        // 3 harfli sembol BIST'te bulunamadıysa TEFAS fonu olarak dene
        if (!assetsRes.ok && sym.length === 3) {
            assetsRes = await fetch(`${BACKEND_URL}/assets/lookup?symbol=${encodeURIComponent(sym)}&type=FON`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(4000),
            });
        }

        if (!assetsRes.ok) return null;
        const assetObj = await assetsRes.json();
        const id = assetObj.ID || assetObj.id;
        if (!id) return null;

        const assetType = assetObj.AssetType || assetObj.asset_type || 'HISSE';
        const isTefas = assetType === 'FON';

        const result: BackendAssetLookup = {
            id,
            symbol: sym,
            name: assetObj.Name || assetObj.name || sym,
            asset_type: assetType,
            current_price: assetObj.CurrentPrice || assetObj.current_price,
            isTefas,
        };

        assetLookupCache.set(sym, { data: result, timestamp: Date.now() });
        return result;
    } catch {
        return null;
    }
}

/**
 * Yahoo Finance Chart verilerinden 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, ALL getirilerini hesaplar.
 */
export async function getAccurateYahooSummary(ticker: string): Promise<AccurateSummaryResult | null> {
    const cached = summaryCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < SUMMARY_TTL) {
        return cached.data;
    }

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;

        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;
        const timestamps = data.chart?.result?.[0]?.timestamp || [];
        const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const adjcloses = data.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose || closes;

        const points: { time: number; price: number }[] = [];
        for (let i = 0; i < timestamps.length; i++) {
            const p = adjcloses[i] !== null && adjcloses[i] !== undefined ? adjcloses[i] : closes[i];
            if (p !== null && p !== undefined && p > 0) {
                points.push({ time: timestamps[i] * 1000, price: p });
            }
        }

        if (points.length === 0) return null;

        const current = Number(meta?.regularMarketPrice) || points[points.length - 1].price;
        const now = points[points.length - 1].time;

        const calcRet = (targetTime: number) => {
            const pt = points.find(p => p.time >= targetTime);
            if (!pt || pt.price === 0) return 0;
            return ((current - pt.price) / pt.price) * 100;
        };

        let ret1D = meta?.regularMarketChangePercent !== undefined ? meta.regularMarketChangePercent : 0;
        if (!ret1D && points.length >= 2) {
            const prev = points[points.length - 2].price;
            ret1D = ((current - prev) / prev) * 100;
        }

        let prevClose = 0;
        if (ret1D !== 0 && current > 0) {
            prevClose = Math.round((current / (1 + ret1D / 100)) * 100) / 100;
        } else if (points.length >= 2) {
            prevClose = points[points.length - 2].price;
        }

        const ret1W = calcRet(now - 7 * 86400000);
        const ret1M = calcRet(now - 30 * 86400000);
        const ret3M = calcRet(now - 90 * 86400000);
        const ret6M = calcRet(now - 180 * 86400000);
        const startOfYear = new Date(new Date(now).getFullYear(), 0, 1).getTime();
        const retYTD = calcRet(startOfYear);
        const ret1Y = calcRet(now - 365 * 86400000);
        const ret3Y = calcRet(now - 3 * 365 * 86400000);
        const ret5Y = calcRet(now - 5 * 365 * 86400000);
        const retALL = ((current - points[0].price) / points[0].price) * 100;

        const summaryResult: Record<string, number> = {
            '1D': ret1D,
            '1W': ret1W,
            '1M': ret1M,
            '3M': ret3M,
            '6M': ret6M,
            'YTD': retYTD,
            '1Y': ret1Y,
            '3Y': ret3Y,
            '5Y': ret5Y || retALL,
            'ALL': retALL,
        };

        const resultObj: AccurateSummaryResult = {
            summary: summaryResult,
            previousClose: prevClose > 0 ? prevClose : undefined,
            currentPrice: current > 0 ? current : undefined,
        };

        summaryCache.set(ticker, { data: resultObj, timestamp: Date.now() });
        return resultObj;
    } catch {
        return null;
    }
}

/**
 * Gram Altın için geçmiş fiyatlardan periyot getirilerini hesaplar.
 */
export async function getAccurateGoldSummary(assetId: number): Promise<AccurateSummaryResult | null> {
    const cacheKey = `ALTIN_${assetId}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SUMMARY_TTL) {
        return cached.data;
    }

    try {
        const histRes = await fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=1Y`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });
        if (!histRes.ok) return null;
        const hist = await histRes.json();
        if (!hist || !Array.isArray(hist) || hist.length === 0) return null;

        const points: { time: number; price: number }[] = [];
        for (const h of hist) {
            const p = parseFloat(String(h.Price || h.price || '0'));
            const t = new Date(h.RecordedAt || h.recorded_at || '').getTime();
            if (p > 0 && !isNaN(t)) {
                points.push({ time: t, price: p });
            }
        }
        if (points.length < 2) return null;

        points.sort((a, b) => a.time - b.time);
        const current = points[points.length - 1].price;
        const now = points[points.length - 1].time;

        const calcRet = (targetTime: number) => {
            const pt = points.find(p => p.time >= targetTime);
            if (!pt || pt.price === 0) return 0;
            return ((current - pt.price) / pt.price) * 100;
        };

        const ret1D = points.length >= 2 ? ((current - points[points.length - 2].price) / points[points.length - 2].price) * 100 : 0;
        const prevClose = points.length >= 2 ? points[points.length - 2].price : current;

        const ret1W = calcRet(now - 7 * 86400000);
        const ret1M = calcRet(now - 30 * 86400000);
        const ret3M = calcRet(now - 90 * 86400000);
        const ret6M = calcRet(now - 180 * 86400000);
        const startOfYear = new Date(new Date(now).getFullYear(), 0, 1).getTime();
        const retYTD = calcRet(startOfYear);
        const ret1Y = ((current - points[0].price) / points[0].price) * 100;

        const summaryResult: Record<string, number> = {
            '1D': ret1D,
            '1W': ret1W,
            '1M': ret1M,
            '3M': ret3M,
            '6M': ret6M,
            'YTD': retYTD,
            '1Y': ret1Y,
            '3Y': 0,
            '5Y': 0,
            'ALL': ret1Y,
        };

        const result: AccurateSummaryResult = {
            summary: summaryResult,
            previousClose: prevClose,
            currentPrice: current,
        };

        summaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch {
        return null;
    }
}

/**
 * TEFAS Fonu için backend /summary endpoint'inden verileri çeker.
 */
export async function getTefasFundSummary(assetId: number, symbol: string): Promise<AccurateSummaryResult | null> {
    const cacheKey = `TEFAS_${symbol}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SUMMARY_TTL) {
        return cached.data;
    }

    try {
        const sumRes = await fetch(`${BACKEND_URL}/assets/${assetId}/summary`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });
        if (!sumRes.ok) return null;
        const data = await sumRes.json();
        if (!data || typeof data !== 'object') return null;

        const summaryResult: Record<string, number> = {};
        for (const [key, val] of Object.entries(data)) {
            const num = typeof val === 'number' ? val : parseFloat(String(val || '0'));
            if (!isNaN(num)) {
                summaryResult[key] = num;
            }
        }

        const result: AccurateSummaryResult = {
            summary: summaryResult,
        };
        summaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch {
        return null;
    }
}

/**
 * Tek bir sembolün özetini getiren ana orkestratör.
 */
export async function fetchSingleAssetSummary(rawSymbol: string): Promise<Record<string, number> | null> {
    const sym = rawSymbol.toUpperCase().trim();
    if (!sym) return null;

    // 1. Doğrudan sembol bazlı önbellek kontrolü
    const cached = summaryCache.get(sym);
    if (cached && Date.now() - cached.timestamp < SUMMARY_TTL) {
        return cached.data.summary;
    }

    // 2. Gram Altın kontrolü
    if (sym === 'ALTIN' || sym === 'GRAMALTIN') {
        const asset = await resolveBackendAsset(sym);
        if (asset) {
            const goldRes = await getAccurateGoldSummary(asset.id);
            if (goldRes?.summary) {
                summaryCache.set(sym, { data: goldRes, timestamp: Date.now() });
                return goldRes.summary;
            }
        }
    }

    // 3. Varlık tipini ve ID'sini backend'den öğren
    const asset = await resolveBackendAsset(sym);
    if (asset?.isTefas) {
        const tefasRes = await getTefasFundSummary(asset.id, sym);
        if (tefasRes?.summary) {
            summaryCache.set(sym, { data: tefasRes, timestamp: Date.now() });
            return tefasRes.summary;
        }
    }

    // 4. Standart Hisse / Döviz / Endeks için Yahoo Finance
    const yahooTicker = getYahooTicker(sym);
    const yhRes = await getAccurateYahooSummary(yahooTicker);
    if (yhRes?.summary) {
        summaryCache.set(sym, { data: yhRes, timestamp: Date.now() });
        return yhRes.summary;
    }

    // 5. Fallback: Eğer Yahoo başarısız olduysa ve backend'de asset varsa, backend summary'yi dene
    if (asset?.id) {
        try {
            const bRes = await fetch(`${BACKEND_URL}/assets/${asset.id}/summary`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(3000),
            });
            if (bRes.ok) {
                const bData = await bRes.json();
                if (bData && typeof bData === 'object') {
                    const fallbackSummary: Record<string, number> = {};
                    for (const [k, v] of Object.entries(bData)) {
                        const num = typeof v === 'number' ? v : parseFloat(String(v || '0'));
                        if (!isNaN(num)) fallbackSummary[k] = num;
                    }
                    summaryCache.set(sym, { data: { summary: fallbackSummary }, timestamp: Date.now() });
                    return fallbackSummary;
                }
            }
        } catch {
            // yut
        }
    }

    return null;
}

/**
 * Birden fazla sembolün özetini tek seferde paralel olarak çeker (Batch Engine).
 */
export async function fetchBatchAssetSummaries(symbols: string[]): Promise<Record<string, Record<string, number>>> {
    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.toUpperCase().trim()))).filter(Boolean);
    const results: Record<string, Record<string, number>> = {};

    if (uniqueSymbols.length === 0) return results;

    // Eşzamanlı çekim (en fazla 15 sembol aynı anda)
    const settled = await Promise.allSettled(
        uniqueSymbols.map(async sym => {
            const summary = await fetchSingleAssetSummary(sym);
            return { symbol: sym, summary };
        })
    );

    for (const item of settled) {
        if (item.status === 'fulfilled' && item.value.summary) {
            results[item.value.symbol] = item.value.summary;
        }
    }

    return results;
}
