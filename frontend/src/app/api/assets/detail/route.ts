import { NextResponse } from 'next/server';
import {
    BACKEND_URL,
    type BackendAsset,
    clientIpHeader,
    fetchSpotGold,
    formatApiPrice,
    getYahooAuth,
    signedChange,
} from '@/lib/marketData';
import { formatTRY } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

// İstemcinin gönderdiği periyotlar; başka bir değer gelirse varsayılan 1Y kullanılır
const ALLOWED_RANGES = new Set(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL']);

interface PriceRecord {
    RecordedAt?: string;
    recorded_at?: string;
    Price?: string | number;
    price?: string | number;
}

interface AssetSummary {
    [key: string]: number;
}

interface Fundamentals {
    marketCap: string;
    peRatio: string;
    dividendYield: string;
    dividendRate: string;
    exDividendDate: string;
    beta: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
    volume: string;
    isStale?: boolean;
    staleMessage?: string;
    lastUpdateDate?: string;
}

type YahooMetric = { raw?: number; fmt?: string } | undefined;

interface YahooQuoteSummaryDetail {
    [key: string]: YahooMetric | YahooQuoteSummaryDetail | undefined;
    marketCap?: YahooMetric;
    trailingPE?: YahooMetric;
    dividendYield?: YahooMetric;
    dividendRate?: YahooMetric;
    exDividendDate?: YahooMetric;
    beta?: YahooMetric;
    fiftyTwoWeekHigh?: YahooMetric;
    fiftyTwoWeekLow?: YahooMetric;
    volume?: YahooMetric;
    regularMarketVolume?: YahooMetric;
}

interface YahooQuoteSummaryData {
    quoteSummary?: {
        result?: Array<{
            summaryDetail?: YahooQuoteSummaryDetail;
            defaultKeyStatistics?: YahooQuoteSummaryDetail;
        }>;
    };
}

// Sembol -> varlık id'si; periyot her değiştiğinde lookup isteği tekrarlanmasın
const assetCache = new Map<string, { id: number; isTefas: boolean; asset?: BackendAsset }>();

function getYahooTicker(symbol: string): string {
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

// Büyük sayıları kısaltır: 1234567 -> "1,23 Mn", 2500000000 -> "2,50 Mr"
function formatLargeNumberTR(num: number): string {
    const two = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1e12) return `${two(num / 1e12)} Tn`;
    if (num >= 1e9) return `${two(num / 1e9)} Mr`;
    if (num >= 1e6) return `${two(num / 1e6)} Mn`;
    return num.toLocaleString('tr-TR');
}

// Hisse temel verileri (piyasa değeri, F/K, temettü...), 5 dakika bellekte tutulur
const fundamentalsCache = new Map<string, { data: Record<string, string>; timestamp: number }>();

async function fetchFundamentals(ticker: string, isTefas: boolean): Promise<Record<string, string>> {
    if (isTefas) return {};

    const cached = fundamentalsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }

    try {
        const auth = await getYahooAuth(3000);
        let qsData: YahooQuoteSummaryData | null = null;
        if (auth) {
            const qsRes = await fetch(
                `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?crumb=${encodeURIComponent(auth.crumb)}&modules=summaryDetail,defaultKeyStatistics`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': auth.cookie },
                    signal: AbortSignal.timeout(4000)
                }
            );
            if (qsRes.ok) {
                qsData = await qsRes.json();
            }
        }

        const sd = qsData?.quoteSummary?.result?.[0]?.summaryDetail;
        const ks = qsData?.quoteSummary?.result?.[0]?.defaultKeyStatistics;

        const formatCap = (val: { raw?: number; fmt?: string } | number | string | null | undefined) => {
            if (!val) return '-';
            const num = typeof val === 'number' ? val : (typeof val === 'string' ? parseFloat(val) : (val.raw || 0));
            if (isNaN(num) || num <= 0) return '-';
            return `${formatLargeNumberTR(num)} ₺`;
        };

        const volumeRaw = sd?.volume?.raw || sd?.regularMarketVolume?.raw;

        const exDateTimestamp = typeof sd?.exDividendDate === 'number' ? sd.exDividendDate : (sd?.exDividendDate?.raw || 0);
        const isExDateFuture = Boolean(exDateTimestamp && (exDateTimestamp * 1000 > Date.now()));

        const formatExDate = (val: { raw?: number; fmt?: string } | number | null | undefined) => {
            if (!val) return '-';
            const timestamp = typeof val === 'number' ? val : (val.raw || 0);
            if (!timestamp) return '-';
            return new Date(timestamp * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        // Yahoo'nun fmt alanları İngilizce biçimde geliyor; hepsini raw değerden tr-TR ile yazıyoruz.
        const rawOf = (...metrics: YahooMetric[]): number | null => {
            for (const m of metrics) {
                if (typeof m?.raw === 'number' && isFinite(m.raw)) return m.raw;
            }
            return null;
        };
        const trNumber = (val: number | null) =>
            val === null ? '-' : val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const trMoney = (val: number | null) => (val === null ? '-' : formatTRY(val));
        const dividendYieldRaw = rawOf(sd?.dividendYield);

        const result: Record<string, string> = {
            marketCap: formatCap(sd?.marketCap || ks?.marketCap),
            peRatio: trNumber(rawOf(sd?.trailingPE, ks?.trailingPE)),
            dividendYield: dividendYieldRaw === null ? '-' : `${trNumber(dividendYieldRaw * 100)}%`,
            dividendRate: trMoney(rawOf(sd?.dividendRate)),
            exDividendDate: formatExDate(sd?.exDividendDate),
            isExDateFuture: isExDateFuture ? 'true' : 'false',
            exDividendLabel: isExDateFuture ? 'Açıklanan Temettü' : 'Son Temettü Tarihi',
            beta: trNumber(rawOf(sd?.beta, ks?.beta)),
            fiftyTwoWeekHigh: trMoney(rawOf(sd?.fiftyTwoWeekHigh)),
            fiftyTwoWeekLow: trMoney(rawOf(sd?.fiftyTwoWeekLow)),
            volume: volumeRaw ? formatLargeNumberTR(volumeRaw) : (sd?.volume?.fmt || sd?.regularMarketVolume?.fmt || '-'),
        };

        fundamentalsCache.set(ticker, { data: result, timestamp: Date.now() });
        return result;
    } catch {
        return {};
    }
}

interface AccurateSummaryResult {
    summary: Record<string, number>;
    previousClose?: number;
    currentPrice?: number;
}

// Periyot getirileri, 5 dakika bellekte tutulur
const summaryHistoryCache = new Map<string, { data: AccurateSummaryResult; timestamp: number }>();

// Hisse, döviz ve endekslerde periyot getirilerini Yahoo'nun 5 yıllık günlük kapanışlarından hesaplar
async function getAccurateSummary(ticker: string, isTefas: boolean, backendSummary: AssetSummary | null): Promise<AccurateSummaryResult | null> {
    if (isTefas) {
        return backendSummary ? { summary: backendSummary } : null;
    }

    const cached = summaryHistoryCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5y`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return backendSummary ? { summary: backendSummary } : null;

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

        if (points.length === 0) return backendSummary ? { summary: backendSummary } : null;

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

        // Önceki kapanış; 1D grafiğinin başlangıç noktası
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
            currentPrice: current > 0 ? current : undefined
        };

        summaryHistoryCache.set(ticker, { data: resultObj, timestamp: Date.now() });
        return resultObj;
    } catch {
        return backendSummary ? { summary: backendSummary } : null;
    }
}

// Gram altında getiriler backend'deki 1 yıllık fiyat geçmişinden hesaplanır
async function getAccurateGoldSummary(assetId: number, headers: Record<string, string>): Promise<AccurateSummaryResult | null> {
    const cacheKey = `ALTIN_${assetId}`;
    const cached = summaryHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }

    try {
        const histRes = await fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=1Y`, { cache: 'no-store', headers });
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

        summaryHistoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol');
    const requestedRange = (searchParams.get('range') || '1Y').toUpperCase();
    const range = ALLOWED_RANGES.has(requestedRange) ? requestedRange : '1Y';

    if (!rawSymbol) {
        return NextResponse.json({ error: 'Sembol belirtilmedi' }, { status: 400 });
    }

    const backendHeaders = clientIpHeader(request);
    const encodedSymbol = encodeURIComponent(rawSymbol);

    try {
        // 1) Varlığın id'si: önce bellekten, yoksa backend'den
        let assetId: number = 0;
        let isTefas: boolean = false;
        let assetObj: BackendAsset | null = null;

        if (assetCache.has(rawSymbol)) {
            const cached = assetCache.get(rawSymbol);
            if (cached) {
                assetId = cached.id;
                isTefas = cached.isTefas;
                assetObj = cached.asset || null;
            }
        } else {
            let assetsRes = await fetch(`${BACKEND_URL}/assets/lookup?symbol=${encodedSymbol}`, {
                cache: 'no-store',
                headers: backendHeaders,
            });
            if (!assetsRes.ok && rawSymbol.length === 3) {
                // 3 harfli sembol hisse olarak bulunamazsa TEFAS fonu olarak dene
                assetsRes = await fetch(`${BACKEND_URL}/assets/lookup?symbol=${encodedSymbol}&type=FON`, {
                    cache: 'no-store',
                    headers: backendHeaders,
                });
            }
            if (!assetsRes.ok) throw new Error('Varlık bulunamadı');
            assetObj = await assetsRes.json();
            
            if (!assetObj || (!assetObj.ID && !assetObj.id)) {
                return NextResponse.json({ chart: [], fundamentals: null, summary: null });
            }
            
            assetId = assetObj.ID || assetObj.id || 0;
            isTefas = (assetObj.AssetType || assetObj.asset_type) === 'FON';
            assetCache.set(rawSymbol, { id: assetId, isTefas, asset: assetObj });
        }

        const yahooTicker = getYahooTicker(rawSymbol);

        // 2) Fiyat geçmişi, backend özeti, temel veriler ve getiriler paralel çekilir
        const [historyRes, summaryRes, extraFundamentals, accurateResult, spotGoldResult] = await Promise.all([
            fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=${encodeURIComponent(range)}`, {
                cache: 'no-store',
                headers: backendHeaders,
            }),
            fetch(`${BACKEND_URL}/assets/${assetId}/summary`, { cache: 'no-store', headers: backendHeaders }),
            fetchFundamentals(yahooTicker, isTefas),
            rawSymbol === 'ALTIN'
                ? getAccurateGoldSummary(assetId, backendHeaders)
                : (!isTefas ? getAccurateSummary(yahooTicker, isTefas, null) : Promise.resolve(null)),
            rawSymbol === 'ALTIN' ? fetchSpotGold(5000) : Promise.resolve(null),
        ]);

        let chartData: { date: string; price: number, rawDate?: Date }[] = [];

        if (historyRes.ok) {
            let history = await historyRes.json();
            if (history && history.length > 0) {
                // Eskiden yeniye sırala
                history.sort((a: PriceRecord, b: PriceRecord) => {
                    const dA = new Date(a.RecordedAt || a.recorded_at || '').getTime();
                    const dB = new Date(b.RecordedAt || b.recorded_at || '').getTime();
                    return dA - dB;
                });

                // Seçilen periyoda göre kırp
                const now = new Date();
                let cutoffDate = new Date(0);

                if (range === '1D') {
                    // Yalnızca son kaydın olduğu gün (İstanbul saatiyle)
                    if (history.length > 0) {
                        const lastRec = history[history.length - 1];
                        const lastDate = new Date(lastRec.RecordedAt || lastRec.recorded_at);
                        const lastDayStr = lastDate.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
                        history = history.filter((record: PriceRecord) => {
                            const recDate = new Date(record.RecordedAt || record.recorded_at || '');
                            return recDate.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === lastDayStr;
                        });
                    }
                } else {
                    if (range === '1W') {
                        cutoffDate = new Date(now);
                        cutoffDate.setDate(now.getDate() - 7);
                    } else if (range === '1M') {
                        cutoffDate = new Date(now);
                        cutoffDate.setMonth(now.getMonth() - 1);
                    } else if (range === '3M') {
                        cutoffDate = new Date(now);
                        cutoffDate.setMonth(now.getMonth() - 3);
                    } else if (range === '6M') {
                        cutoffDate = new Date(now);
                        cutoffDate.setMonth(now.getMonth() - 6);
                    } else if (range === 'YTD') {
                        cutoffDate = new Date(now.getFullYear(), 0, 1);
                    } else if (range === '1Y') {
                        cutoffDate = new Date(now);
                        cutoffDate.setFullYear(now.getFullYear() - 1);
                    } else if (range === '3Y') {
                        cutoffDate = new Date(now);
                        cutoffDate.setFullYear(now.getFullYear() - 3);
                    } else if (range === '5Y' || range === 'ALL') {
                        // ALL da en fazla 5 yıl gösterir
                        cutoffDate = new Date(now);
                        cutoffDate.setFullYear(now.getFullYear() - 5);
                    }

                    history = history.filter((record: PriceRecord) => {
                        const recDate = new Date(record.RecordedAt || record.recorded_at || '');
                        return recDate.getTime() >= cutoffDate.getTime();
                    });
                }

                // 6M'de nokta çoksa her günden ilk ve son kaydı bırak
                if (range === '6M' && history.length > 250) {
                    const sampled: PriceRecord[] = [];
                    const byDay = new Map<string, PriceRecord[]>();
                    for (const rec of history) {
                        const recDate = new Date(rec.RecordedAt || rec.recorded_at || '');
                        const dayKey = recDate.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
                        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
                        byDay.get(dayKey)!.push(rec);
                    }
                    for (const [, dayRecs] of byDay) {
                        if (dayRecs.length === 1) {
                            sampled.push(dayRecs[0]);
                        } else {
                            sampled.push(dayRecs[0]); // sabah
                            sampled.push(dayRecs[dayRecs.length - 1]); // akşam
                        }
                    }
                    history = sampled;
                }

                chartData = history.map((record: PriceRecord) => {
                    const d = new Date(record.RecordedAt || record.recorded_at || '');
                    const tzOptions: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Istanbul' };
                    let dateStr = '';
                    
                    if (range === '1D') {
                        dateStr = d.toLocaleTimeString('tr-TR', { ...tzOptions, hour12: false, hour: '2-digit', minute: '2-digit' });
                    } else if (range === '1W' || range === '1M' || range === '3M') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                        if (!isTefas) {
                            const adjustedD = new Date(d);
                            if (range === '1M' || range === '3M') {
                                if (adjustedD.getMinutes() === 30) {
                                    adjustedD.setMinutes(0);
                                }
                            } else if (range === '1W' || range === '1D') {
                                if (adjustedD.getHours() === 9 && adjustedD.getMinutes() === 30) {
                                    adjustedD.setMinutes(0);
                                }
                            }
                            dateStr += ' ' + adjustedD.toLocaleTimeString('tr-TR', { ...tzOptions, hour12: false, hour: '2-digit', minute: '2-digit' });
                        }
                    } else if (range === '6M') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                        if (!isTefas) {
                            dateStr += ' ' + d.toLocaleTimeString('tr-TR', { ...tzOptions, hour12: false, hour: '2-digit', minute: '2-digit' });
                        }
                    } else if (range === 'YTD' || range === '1Y') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                    } else if (range === '3Y') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short', year: '2-digit' });
                    } else if (range === 'ALL' || range === '5Y') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short', year: '2-digit' });
                    } else {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                    }
                    
                    return {
                        date: dateStr,
                        price: parseFloat(String(record.Price || record.price || 0)),
                        rawDate: d,
                    };
                });
            }
        }

        let summaryData = accurateResult?.summary || null;
        if (!summaryData && summaryRes.ok) {
            summaryData = await summaryRes.json();
        }

        let previousClose = accurateResult?.previousClose;
        if (!previousClose && spotGoldResult?.price && spotGoldResult.change) {
            const chg = parseFloat(spotGoldResult.change);
            if (!isNaN(chg) && chg !== -100) {
                previousClose = spotGoldResult.price / (1 + chg / 100);
            }
        }

        // Özette 3Y yoksa (fonlarda olduğu gibi) 3Y ve 5Y'yi tüm fiyat geçmişinden hesapla
        if (summaryData && (!summaryData['3Y'] || summaryData['3Y'] === 0)) {
            try {
                const allHistRes = await fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=ALL`, {
                    cache: 'no-store',
                    headers: backendHeaders,
                });
                if (allHistRes.ok) {
                    const allHist = await allHistRes.json();
                    if (allHist && allHist.length > 0) {
                        const nowTime = Date.now();
                        const threeYearsAgo = nowTime - 3 * 365 * 86400000;
                        const lastPoint = allHist[allHist.length - 1];
                        const currP = parseFloat(lastPoint.Price || lastPoint.price || '0');
                        
                        let p3y: number | null = null;
                        for (const h of allHist) {
                            const t = new Date(h.RecordedAt || h.recorded_at).getTime();
                            if (t >= threeYearsAgo) {
                                p3y = parseFloat(h.Price || h.price || '0');
                                break;
                            }
                        }
                        if (p3y && p3y > 0 && currP > 0) {
                            summaryData['3Y'] = ((currP - p3y) / p3y) * 100;
                        }
                        if (!summaryData['5Y'] && allHist.length > 0) {
                            const firstP = parseFloat(allHist[0].Price || allHist[0].price || '0');
                            if (firstP > 0 && currP > 0) {
                                summaryData['5Y'] = ((currP - firstP) / firstP) * 100;
                            }
                        }
                    }
                }
            } catch (calcErr) {
                console.error('3Y hesaplama hatası:', calcErr);
            }
        }

        // 3) Fiyat geçmişi neredeyse boşsa backend'den geçmişi doldurmasını iste (yanıtı beklenmez)
        if (chartData.length < 3 && range !== '1D') {
            fetch(`${BACKEND_URL}/assets/${assetId}/backfill`, { method: 'POST', headers: backendHeaders }).catch(console.error);
        }

        // 4) Son kaydın tarihine göre "Son Güncelleme" notu
        let latestRecordTime: Date | null = null;
        if (chartData.length > 0) {
            latestRecordTime = chartData[chartData.length - 1].rawDate || null;
        }

        const nowIstanbul = new Date();
        const tz = 'Europe/Istanbul';
        
        let isStale = false;
        let staleMessage = "";
        let lastUpdateDateStr = "";

        if (latestRecordTime) {
            const todayStr = nowIstanbul.toLocaleDateString('tr-TR', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
            const recStr = latestRecordTime.toLocaleDateString('tr-TR', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
            const formattedRecDate = latestRecordTime.toLocaleDateString('tr-TR', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' });
            lastUpdateDateStr = formattedRecDate;

            const isToday = (todayStr === recStr);
            
            if (isTefas) {
                if (!isToday) {
                    isStale = true;
                    staleMessage = `Son Güncelleme: ${formattedRecDate} (TEFAS verisi bekleniyor)`;
                } else {
                    isStale = false;
                    staleMessage = `Son Güncelleme: ${formattedRecDate} (Bugün)`;
                }
            } else {
                if (!isToday) {
                    isStale = true;
                    staleMessage = `Son Güncelleme: ${formattedRecDate}`;
                } else {
                    isStale = false;
                    staleMessage = `Son Güncelleme: Bugün ${latestRecordTime.toLocaleTimeString('tr-TR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}`;
                }
            }
        }

        if (rawSymbol === 'ALTIN') {
            const spot = spotGoldResult || (await fetchSpotGold(5000));
            if (spot && spot.price > 0) {
                // Güncel gram altın fiyatı yalnızca son noktaya yazılır, geçmiş eğriye dokunulmaz
                if (chartData.length > 0) {
                    const lastPt = chartData[chartData.length - 1];
                    const todayStr = new Date().toDateString();
                    const lastPtDate = new Date(lastPt.rawDate || lastPt.date).toDateString();
                    if (todayStr === lastPtDate || lastPt.date.includes(':')) {
                        lastPt.price = spot.price;
                    } else {
                        chartData.push({
                            date: new Date().toISOString(),
                            price: spot.price,
                            rawDate: new Date(),
                        });
                    }
                }
                if (!summaryData) summaryData = {};
                if (spot.change) {
                    summaryData['1D'] = parseFloat(spot.change);
                }
            }

            extraFundamentals.marketCap = '-';
            extraFundamentals.peRatio = '-';
            extraFundamentals.dividendYield = '-';
            extraFundamentals.dividendRate = '-';
            extraFundamentals.beta = '-';
            if (chartData.length > 0) {
                const prices = chartData.map(c => c.price).filter(p => p > 0);
                if (prices.length > 0) {
                    const minP = Math.min(...prices);
                    const maxP = Math.max(...prices);
                    extraFundamentals.fiftyTwoWeekLow = minP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
                    extraFundamentals.fiftyTwoWeekHigh = maxP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
                }
            }
        }

        const fundamentals: Fundamentals = {
            marketCap: extraFundamentals.marketCap || '-',
            peRatio: extraFundamentals.peRatio || '-',
            dividendYield: extraFundamentals.dividendYield || '-',
            dividendRate: extraFundamentals.dividendRate || '-',
            exDividendDate: extraFundamentals.exDividendDate || '-',
            beta: extraFundamentals.beta || '-',
            fiftyTwoWeekHigh: extraFundamentals.fiftyTwoWeekHigh || '-',
            fiftyTwoWeekLow: extraFundamentals.fiftyTwoWeekLow || '-',
            volume: extraFundamentals.volume || '-',
            isStale,
            staleMessage,
            lastUpdateDate: lastUpdateDateStr
        };

        // rawDate istemciye gönderilmez
        const cleanChartData = chartData.map(d => ({ date: d.date, price: d.price }));
        if (range === '1D' && previousClose && previousClose > 0) {
            cleanChartData.unshift({
                date: 'Dün',
                price: previousClose
            });
        } else if (cleanChartData.length === 1) {
            cleanChartData.unshift({
                date: 'Önceki',
                price: cleanChartData[0].price
            });
        }

        let latestPrice = 0;
        if (cleanChartData.length > 0) {
            const last = cleanChartData[cleanChartData.length - 1];
            if (typeof last.price === 'number' && last.price > 0) {
                latestPrice = last.price;
            }
        }
        if (latestPrice === 0 && assetObj) {
            latestPrice = parseFloat(assetObj.CurrentPrice || assetObj.current_price || '0');
        }

        let latestChange = '0.00';
        let latestPositive = true;
        if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D'])) {
            const val = summaryData['1D'];
            latestChange = signedChange(val);
            latestPositive = val >= 0;
        } else if (cleanChartData.length >= 2) {
            const last = cleanChartData[cleanChartData.length - 1].price;
            const prev = cleanChartData[0].price;
            if (prev > 0) {
                const pct = ((last - prev) / prev) * 100;
                latestChange = signedChange(pct);
                latestPositive = pct >= 0;
            }
        }

        const assetInfo = assetObj ? {
            id: assetId,
            symbol: rawSymbol,
            name: assetObj.Name || assetObj.name || rawSymbol,
            asset_type: isTefas ? 'FON' : (assetObj.AssetType || assetObj.asset_type || 'HISSE'),
            current_price: latestPrice > 0 ? formatApiPrice(latestPrice) : (assetObj.CurrentPrice || assetObj.current_price || '0'),
            change: latestChange,
            positive: latestPositive,
        } : null;

        return NextResponse.json(
            { asset: assetInfo, chart: cleanChartData, fundamentals, summary: summaryData, previousClose },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    } catch (error) {
        console.error('/api/assets/detail hatası:', error);
        return NextResponse.json(
            { chart: [], fundamentals: null, summary: null },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    }
}
