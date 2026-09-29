import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

// Bellek içi sembol önbelleği (her buton tıklamasında gereksiz lookup isteği atılmasını engeller)
const assetCache = new Map<string, { id: number; isTefas: boolean; asset?: any }>();

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

// Yahoo Crumb / Cookie Önbelleği (1 saat)
let yahooCookieCache = '';
let yahooCrumbCache = '';
let yahooCrumbExpiry = 0;

async function getYahooCrumb(): Promise<{ cookie: string; crumb: string } | null> {
    const now = Date.now();
    if (yahooCookieCache && yahooCrumbCache && now < yahooCrumbExpiry) {
        return { cookie: yahooCookieCache, crumb: yahooCrumbCache };
    }
    try {
        const r1 = await fetch('https://fc.yahoo.com', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3000)
        });
        const cookie = r1.headers.get('set-cookie');
        if (!cookie) return null;

        const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie },
            signal: AbortSignal.timeout(3000)
        });
        if (!r2.ok) return null;
        const crumb = await r2.text();
        if (!crumb || crumb.includes('Too Many') || crumb.includes('Unauthorized')) return null;

        yahooCookieCache = cookie;
        yahooCrumbCache = crumb;
        yahooCrumbExpiry = now + 60 * 60 * 1000;
        return { cookie, crumb };
    } catch {
        return null;
    }
}

// Spot Gram Altın (Truncgil / Kapalıçarşı Serbest Piyasa)
async function fetchSpotGoldDetail(): Promise<{ price: number; change: string; positive: boolean } | null> {
    try {
        const res = await fetch('https://finans.truncgil.com/v4/today.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const text = await res.text();
        const m = text.match(/"GRA"\s*:\s*(\{[^}]+\})/);
        if (!m) return null;
        const gra = JSON.parse(m[1]);
        const price = Number(gra.Selling || gra.Buying || 0);
        if (price <= 0) return null;
        const changePct = Number(gra.Change || 0);
        return {
            price,
            change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2),
            positive: changePct >= 0,
        };
    } catch {
        return null;
    }
}

// Temel Bilgiler Önbelleği (5 dakika)
const fundamentalsCache = new Map<string, { data: Record<string, string>; timestamp: number }>();

async function fetchFundamentals(ticker: string, isTefas: boolean): Promise<Record<string, string>> {
    if (isTefas) return {};

    const cached = fundamentalsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }

    try {
        const auth = await getYahooCrumb();
        let qsData: any = null;
        if (auth) {
            const qsRes = await fetch(
                `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?crumb=${auth.crumb}&modules=summaryDetail,defaultKeyStatistics`,
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

        const formatCap = (val: any) => {
            if (!val) return '-';
            const num = typeof val === 'number' ? val : (val.raw || parseFloat(val));
            if (isNaN(num) || num <= 0) return '-';
            if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T ₺`;
            if (num >= 1e9) return `${(num / 1e9).toFixed(2)} Mr ₺`;
            if (num >= 1e6) return `${(num / 1e6).toFixed(2)} M ₺`;
            return `${num.toLocaleString('tr-TR')} ₺`;
        };

        const exDateTimestamp = typeof sd?.exDividendDate === 'number' ? sd.exDividendDate : (sd?.exDividendDate?.raw || 0);
        const isExDateFuture = Boolean(exDateTimestamp && (exDateTimestamp * 1000 > Date.now()));

        const formatExDate = (val: any) => {
            if (!val) return '-';
            const timestamp = typeof val === 'number' ? val : (val.raw || 0);
            if (!timestamp) return '-';
            return new Date(timestamp * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        const result: Record<string, string> = {
            marketCap: formatCap(sd?.marketCap || ks?.marketCap),
            peRatio: sd?.trailingPE?.fmt || ks?.trailingPE?.fmt || (typeof sd?.trailingPE === 'number' ? sd.trailingPE.toFixed(2) : '-'),
            dividendYield: sd?.dividendYield?.fmt || (sd?.dividendYield?.raw ? `%${(sd.dividendYield.raw * 100).toFixed(2)}` : '-'),
            dividendRate: sd?.dividendRate?.fmt ? `${sd.dividendRate.fmt} ₺` : (sd?.dividendRate?.raw ? `${sd.dividendRate.raw.toFixed(2)} ₺` : '-'),
            exDividendDate: formatExDate(sd?.exDividendDate),
            isExDateFuture: isExDateFuture ? 'true' : 'false',
            exDividendLabel: isExDateFuture ? 'Açıklanan Temettü' : 'Son Temettü Tarihi',
            beta: sd?.beta?.fmt || ks?.beta?.fmt || (typeof sd?.beta === 'number' ? sd.beta.toFixed(2) : '-'),
            fiftyTwoWeekHigh: sd?.fiftyTwoWeekHigh?.fmt ? `${sd.fiftyTwoWeekHigh.fmt} ₺` : (sd?.fiftyTwoWeekHigh?.raw ? `${sd.fiftyTwoWeekHigh.raw.toFixed(2)} ₺` : '-'),
            fiftyTwoWeekLow: sd?.fiftyTwoWeekLow?.fmt ? `${sd.fiftyTwoWeekLow.fmt} ₺` : (sd?.fiftyTwoWeekLow?.raw ? `${sd.fiftyTwoWeekLow.raw.toFixed(2)} ₺` : '-'),
            volume: sd?.volume?.fmt || sd?.regularMarketVolume?.fmt || (sd?.volume?.raw ? `${(sd.volume.raw / 1e6).toFixed(2)}M` : '-'),
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

// Getiri Özeti Önbelleği (5 dakika)
const summaryHistoryCache = new Map<string, { data: AccurateSummaryResult; timestamp: number }>();

async function getAccurateSummary(ticker: string, isTefas: boolean, backendSummary: any): Promise<AccurateSummaryResult | null> {
    if (isTefas) {
        return backendSummary ? { summary: backendSummary } : null;
    }

    const cached = summaryHistoryCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`, {
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

        // Dünkü resmi kapanış fiyatı (1D başlangıç noktası)
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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol');
    let range = searchParams.get('range') || '1Y';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!rawSymbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    let backendRange = range;

    try {
        // Step 1: Find the Asset ID (Önbellekten veya backend'den)
        let assetId: number;
        let isTefas: boolean;
        let assetObj: any = null;

        if (assetCache.has(rawSymbol)) {
            const cached = assetCache.get(rawSymbol) as any;
            assetId = cached.id;
            isTefas = cached.isTefas;
            assetObj = cached.asset;
        } else {
            let assetsRes = await fetch(BACKEND_URL + '/assets/lookup?symbol=' + rawSymbol, { cache: 'no-store' });
            if (!assetsRes.ok && rawSymbol.length === 3) {
                // 3 harfli sembol BIST'te bulunamadıysa TEFAS fonu olarak dene
                assetsRes = await fetch(BACKEND_URL + '/assets/lookup?symbol=' + rawSymbol + '&type=FON', { cache: 'no-store' });
            }
            if (!assetsRes.ok) throw new Error("Failed to fetch assets");
            assetObj = await assetsRes.json();
            
            if (!assetObj || (!assetObj.ID && !assetObj.id)) {
                return NextResponse.json({ chart: [], fundamentals: null, summary: null });
            }
            
            assetId = assetObj.ID || assetObj.id;
            isTefas = (assetObj.AssetType || assetObj.asset_type) === 'FON';
            assetCache.set(rawSymbol, { id: assetId, isTefas, asset: assetObj });
        }

        const yahooTicker = getYahooTicker(rawSymbol);

        // Step 2: Fetch Chart Data + Backend Summary + Real Fundamentals/Summary in parallel
        // no-store kullanılır: TEFAS ve BIST için anlık ve taze veriler gecikmesiz gelir
        const [historyRes, summaryRes, extraFundamentals, accurateResult, spotGoldResult] = await Promise.all([
            fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=${backendRange}`, { cache: 'no-store' }),
            fetch(`${BACKEND_URL}/assets/${assetId}/summary`, { cache: 'no-store' }),
            fetchFundamentals(yahooTicker, isTefas),
            !isTefas && rawSymbol !== 'ALTIN' ? getAccurateSummary(yahooTicker, isTefas, null) : Promise.resolve(null),
            rawSymbol === 'ALTIN' ? fetchSpotGoldDetail() : Promise.resolve(null),
        ]);

        let chartData: { date: string; price: number, rawDate?: Date }[] = [];
        
        if (historyRes.ok) {
            let history = await historyRes.json();
            if (history && history.length > 0) {
                // Ensure array is strictly oldest-first (ASC)
                history.sort((a: any, b: any) => {
                    const dA = new Date(a.RecordedAt || a.recorded_at).getTime();
                    const dB = new Date(b.RecordedAt || b.recorded_at).getTime();
                    return dA - dB;
                });

                // Filter history by range
                const now = new Date();
                let cutoffDate = new Date(0); // ALL
                
                if (range === '1D') {
                    if (history.length > 0) {
                        const lastRec = history[history.length - 1];
                        const lastDate = new Date(lastRec.RecordedAt || lastRec.recorded_at);
                        const lastDayStr = lastDate.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
                        history = history.filter((record: any) => {
                            const recDate = new Date(record.RecordedAt || record.recorded_at);
                            return recDate.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === lastDayStr;
                        });
                    }
                } else if (range === 'CUSTOM' && startDateParam) {
                    const sDate = new Date(startDateParam);
                    const eDate = endDateParam ? new Date(endDateParam) : new Date();
                    eDate.setHours(23, 59, 59, 999);
                    history = history.filter((record: any) => {
                        const recDate = new Date(record.RecordedAt || record.recorded_at);
                        return recDate.getTime() >= sDate.getTime() && recDate.getTime() <= eDate.getTime();
                    });
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
                        cutoffDate = new Date(now);
                        cutoffDate.setFullYear(now.getFullYear() - 5);
                    }

                    history = history.filter((record: any) => {
                        const recDate = new Date(record.RecordedAt || record.recorded_at);
                        return recDate.getTime() >= cutoffDate.getTime();
                    });
                }

                // 6M: 12 saatte bir (Her işlem günü sabah ve akşam olmak üzere günde 2 nokta)
                if (range === '6M' && history.length > 250) {
                    const sampled: any[] = [];
                    const byDay = new Map<string, any[]>();
                    for (const rec of history) {
                        const recDate = new Date(rec.RecordedAt || rec.recorded_at);
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

                chartData = history.map((record: any) => {
                    const d = new Date(record.RecordedAt || record.recorded_at);
                    const tzOptions: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Istanbul' };
                    let dateStr = '';
                    
                    if (range === '1D') {
                        dateStr = d.toLocaleTimeString('tr-TR', { ...tzOptions, hour12: false, hour: '2-digit', minute: '2-digit' });
                    } else if (range === '1W' || range === '1M' || range === '3M') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                        if (!isTefas) {
                            let adjustedD = new Date(d);
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
                    } else if (range === 'CUSTOM') {
                        if (history.length <= 40) {
                            dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                        } else {
                            dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short', year: 'numeric' });
                        }
                    } else {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, day: 'numeric', month: 'short' });
                    }
                    
                    return {
                        date: dateStr,
                        price: parseFloat(record.Price || record.price),
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

        // Fonlar ve 3Y eksik olan varlıklar için 3Y ve 5Y hesaplama desteği
        if (summaryData && (!summaryData['3Y'] || summaryData['3Y'] === 0)) {
            try {
                const allHistRes = await fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=ALL`, { cache: 'no-store' });
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

        // Step 3: Check if we need to trigger backfill
        if (chartData.length < 3 && range !== '1D') {
            fetch(`${BACKEND_URL}/assets/${assetId}/backfill`, { method: 'POST' }).catch(console.error);
        }

        // Step 4: Fundamentals / UI Hints & Son Güncelleme Kontrolü
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
            const spot = spotGoldResult || (await fetchSpotGoldDetail());
            if (spot && spot.price > 0 && chartData.length > 0) {
                const lastPt = chartData[chartData.length - 1];
                if (lastPt && lastPt.price > 0) {
                    const ratio = spot.price / lastPt.price;
                    chartData.forEach(pt => {
                        pt.price = Math.round(pt.price * ratio * 100) / 100;
                    });
                }
                if (!summaryData) summaryData = {};
                summaryData['1D'] = parseFloat(spot.change);
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

        const fundamentals: any = {
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

        // Clean rawDate before sending to client
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
            latestChange = (val >= 0 ? '+' : '') + val.toFixed(2);
            latestPositive = val >= 0;
        } else if (cleanChartData.length >= 2) {
            const last = cleanChartData[cleanChartData.length - 1].price;
            const prev = cleanChartData[0].price;
            if (prev > 0) {
                const pct = ((last - prev) / prev) * 100;
                latestChange = (pct >= 0 ? '+' : '') + pct.toFixed(2);
                latestPositive = pct >= 0;
            }
        }

        const formatPriceLocal = (p: number): string => {
            return p >= 100 ? p.toFixed(2) : (p >= 1 ? p.toFixed(2) : p.toFixed(4));
        };

        const assetInfo = assetObj ? {
            id: assetId,
            symbol: rawSymbol,
            name: assetObj.Name || assetObj.name || rawSymbol,
            asset_type: isTefas ? 'FON' : (assetObj.AssetType || assetObj.asset_type || 'HISSE'),
            current_price: latestPrice > 0 ? formatPriceLocal(latestPrice) : (assetObj.CurrentPrice || assetObj.current_price || '0'),
            change: latestChange,
            positive: latestPositive,
        } : null;

        return NextResponse.json(
            { asset: assetInfo, chart: cleanChartData, fundamentals, summary: summaryData, previousClose },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    } catch (error) {
        console.error("Route error:", error);
        return NextResponse.json(
            { chart: [], fundamentals: null, summary: null },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    }
}
