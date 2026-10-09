import { NextResponse } from 'next/server';
import { normalizeSearchText, scoreAssetMatch } from '@/lib/searchUtils';
import {
    BACKEND_URL,
    type BackendAsset,
    type ChartQuote,
    clientIpHeader,
    fetchSpotGold,
    fetchYahooChart as fetchChart,
    formatApiPrice,
    signedChange,
} from '@/lib/marketData';

export const dynamic = 'force-dynamic';

// Arama sorgusu için üst sınır; daha uzun metinler kesilir
const MAX_QUERY_LENGTH = 50;

interface NormalizedAsset {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    current_price: string;
    change: string;
    positive: boolean;
}

interface TefasFundItem {
    symbol: string;
    name: string;
    price: number;
}

interface RawTefasItem {
    fonKodu?: string;
    fonUnvan?: string;
    fiyat?: number;
}

interface YahooSearchQuote {
    symbol: string;
    exchange?: string;
}

// Bu route'ta Yahoo istekleri 2,5 saniyede kesilir; arama kutusu uzun süre beklemesin
function fetchYahooChart(ticker: string): Promise<ChartQuote | null> {
    return fetchChart(ticker, { timeoutMs: 2500 });
}

// TEFAS fon kataloğu (yatırım ve emeklilik fonları), 60 dakika bellekte tutulur
let tefasCatalogCache: TefasFundItem[] = [];
let lastTefasFetchTime = 0;

async function fetchTefasType(fonTipi: 'YAT' | 'EMK', bas: string, bit: string): Promise<TefasFundItem[]> {
    try {
        const res = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://www.tefas.gov.tr',
                'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: JSON.stringify({
                fonTipi,
                basTarih: bas,
                bitTarih: bit,
                basSira: 1,
                bitSira: 5000,
                dil: 'TR',
            }),
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data?.resultList)) return [];
        return data.resultList
            .map((item: RawTefasItem) => ({
                symbol: String(item.fonKodu || '').toUpperCase(),
                name: String(item.fonUnvan || ''),
                price: Number(item.fiyat || 0),
            }))
            .filter((x: TefasFundItem) => x.symbol.length > 0);
    } catch {
        return [];
    }
}

async function getTefasCatalog(): Promise<TefasFundItem[]> {
    const now = Date.now();
    // 60 dakikalık önbellek geçerliyse doğrudan dön
    if (tefasCatalogCache.length > 0 && now - lastTefasFetchTime < 60 * 60 * 1000) {
        return tefasCatalogCache;
    }

    try {
        // Hafta sonları ve resmi tatillerde TEFAS aynı güne boş liste döndüğü için
        // basTarih son 7 günü kapsayacak şekilde dinamik hesaplanır
        const nowObj = new Date();
        const bitTarih = nowObj.toISOString().slice(0, 10).replace(/-/g, '');
        const pastDate = new Date(nowObj.getTime() - 7 * 24 * 60 * 60 * 1000);
        const basTarih = pastDate.toISOString().slice(0, 10).replace(/-/g, '');

        // Hem Yatırım Fonları (YAT) hem de Emeklilik Fonları (EMK) paralel taranır
        const [yatList, emkList] = await Promise.all([
            fetchTefasType('YAT', basTarih, bitTarih),
            fetchTefasType('EMK', basTarih, bitTarih),
        ]);

        const combinedMap = new Map<string, TefasFundItem>();
        for (const item of [...yatList, ...emkList]) {
            if (item.symbol && !combinedMap.has(item.symbol)) {
                combinedMap.set(item.symbol, item);
            }
        }

        if (combinedMap.size > 0) {
            tefasCatalogCache = Array.from(combinedMap.values());
            lastTefasFetchTime = now;
        }
    } catch (err) {
        console.warn('TEFAS katalog çekim uyarısı:', err);
    }
    return tefasCatalogCache;
}

// Döviz, endeks, altın ve birkaç büyük hissenin Yahoo fiyatları; 30 saniye bellekte tutulur
const QUOTE_TTL_MS = 30 * 1000;
let liveQuotesCache: Record<string, ChartQuote> = {};
let lastQuotesFetchTime = 0;

// Aramada tek tek çekilen fiyatlar; yukarıdaki önbellekle aynı 30 saniyelik ömrü taşır
const searchQuoteCache = new Map<string, { quote: ChartQuote; at: number }>();

function getFreshQuote(symbol: string): ChartQuote | undefined {
    if (Date.now() - lastQuotesFetchTime < QUOTE_TTL_MS && liveQuotesCache[symbol]) {
        return liveQuotesCache[symbol];
    }
    const hit = searchQuoteCache.get(symbol);
    return hit && Date.now() - hit.at < QUOTE_TTL_MS ? hit.quote : undefined;
}

const MACRO_SYMBOLS: Record<string, string> = {
    'USDTRY': 'USDTRY=X',
    'EURTRY': 'EURTRY=X',
    'XU100': 'XU100.IS',
    'XU030': 'XU030.IS',
    'GOLD_OZ': 'GC=F',
    'INTET': 'INTET.IS',
    'QUICK': 'QUICK.IS',
    'THYAO': 'THYAO.IS',
    'ASELS': 'ASELS.IS',
    'TUPRS': 'TUPRS.IS',
    'KCHOL': 'KCHOL.IS',
    'SASA': 'SASA.IS',
    'ASTOR': 'ASTOR.IS',
    'GARAN': 'GARAN.IS',
    'AKBNK': 'AKBNK.IS',
};

async function getLiveMarketQuotes(): Promise<Record<string, ChartQuote>> {
    const now = Date.now();
    if (Object.keys(liveQuotesCache).length > 0 && now - lastQuotesFetchTime < QUOTE_TTL_MS) {
        return liveQuotesCache;
    }

    // Bir sembol bu turda alınamazsa önceki fiyatı korunur
    const quotes: Record<string, ChartQuote> = { ...liveQuotesCache };
    const [spotGold] = await Promise.all([
        fetchSpotGold(3000),
        ...Object.entries(MACRO_SYMBOLS).map(async ([internalSym, yahooSym]) => {
            const q = await fetchYahooChart(yahooSym);
            if (q) quotes[internalSym] = q;
        }),
    ]);

    if (spotGold && spotGold.price > 0) {
        quotes['ALTIN'] = spotGold;
    } else if (quotes['GOLD_OZ'] && quotes['USDTRY']) {
        // Gram altın alınamazsa ons fiyatından hesapla: ons * USDTRY / 31,1034768 (bir onsun gram karşılığı)
        const goldPrice = (quotes['GOLD_OZ'].price * quotes['USDTRY'].price) / 31.1034768;
        const goldPrev = (quotes['GOLD_OZ'].prev * quotes['USDTRY'].prev) / 31.1034768;
        const pct = goldPrev > 0 ? ((goldPrice - goldPrev) / goldPrev) * 100 : 0;
        quotes['ALTIN'] = {
            price: goldPrice,
            prev: goldPrev,
            change: signedChange(pct),
            positive: pct >= 0,
            name: 'Gram Altın',
        };
    }

    liveQuotesCache = quotes;
    lastQuotesFetchTime = now;
    return quotes;
}

// Backend'deki tüm varlıkların günlük değişim yüzdeleri (id -> %), 2 dakika bellekte tutulur
let allDailyChangesCache: Record<string, number> = {};
let lastAllDailyChangesFetchTime = 0;

async function getAllDailyChanges(headers: Record<string, string>): Promise<Record<string, number>> {
    const now = Date.now();
    if (Object.keys(allDailyChangesCache).length > 0 && now - lastAllDailyChangesFetchTime < 2 * 60 * 1000) {
        return allDailyChangesCache;
    }
    try {
        const res = await fetch(`${BACKEND_URL}/assets/daily-changes`, { cache: 'no-store', headers });
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
                allDailyChangesCache = data;
                lastAllDailyChangesFetchTime = now;
            }
        }
    } catch (err) {
        console.warn('Tüm günlük değişimler alınamadı:', err);
    }
    return allDailyChangesCache;
}

// GET /api/assets          -> tüm katalog
// GET /api/assets?q=metin   -> en fazla 10 arama sonucu
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH);
        const backendHeaders = clientIpHeader(request);

        // Aramada makro fiyatları beklemeyiz; sonuçlar aşağıda yalnızca gerekenler için zenginleştirilir
        const [liveQuotes, backendRes, dailyChangesMap] = await Promise.all([
            !query ? getLiveMarketQuotes() : Promise.resolve({} as Record<string, ChartQuote>),
            fetch(`${BACKEND_URL}/assets`, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json', ...backendHeaders },
            }).catch(() => null),
            getAllDailyChanges(backendHeaders),
        ]);

        const rawData: BackendAsset[] = (backendRes?.ok && await backendRes.json().catch(() => [])) || [];

        const normalized: NormalizedAsset[] = (Array.isArray(rawData) ? rawData : [])
            .filter((item: BackendAsset) => {
                const assetType = String(item.AssetType ?? item.asset_type ?? 'HISSE').trim().toUpperCase();
                const idStr = String(item.ID ?? item.id ?? 0);
                // Girişim sermayesi ve gayrimenkul fonlarını, bir de günlük değişimi olmayan (fiyatı akmayan) fonları gizle
                if (assetType === 'FON') {
                    const cleanName = String(item.Name ?? item.name ?? '').toUpperCase();
                    if (cleanName.includes('GİRİŞİM SERMAYESİ') || cleanName.includes('GAYRİMENKUL YATIRIM FONU')) {
                        return false;
                    }
                    const chg = dailyChangesMap[idStr];
                    return chg !== undefined && chg !== 0;
                }
                return true;
            })
            .map((item: BackendAsset) => {
                const id = Number(item.ID ?? item.id ?? 0);
                const symbol = String(item.Symbol ?? item.symbol ?? '').trim().toUpperCase();
                const name = String(item.Name ?? item.name ?? symbol).trim();
                const assetType = String(item.AssetType ?? item.asset_type ?? 'HISSE').trim().toUpperCase();
                let price = parseFloat(item.CurrentPrice ?? item.current_price ?? '0');

                // Backend'in fiyat geçmişinden hesapladığı günlük değişim
                let change = '0.00';
                let positive = true;
                const dbChange = dailyChangesMap[String(id)];
                if (typeof dbChange === 'number' && !isNaN(dbChange)) {
                    change = signedChange(dbChange);
                    positive = dbChange >= 0;
                }

                // Yahoo'dan güncel fiyat varsa onu kullan
                const live = liveQuotes[symbol];
                if (live && live.price > 0) {
                    price = live.price;
                    change = live.change;
                    positive = live.positive;
                }

                return {
                    id,
                    symbol,
                    name,
                    asset_type: assetType,
                    current_price: formatApiPrice(price),
                    change,
                    positive,
                };
            });

        // Veritabanında olmayan döviz, endeks ve altını Yahoo/truncgil fiyatıyla ekle
        const existing = new Set(normalized.map((a) => a.symbol));
        const MACRO_INJECT: { sym: string; name: string; type: string }[] = [
            { sym: 'USDTRY', name: 'Amerikan Doları', type: 'DOVIZ' },
            { sym: 'EURTRY', name: 'Euro', type: 'DOVIZ' },
            { sym: 'XU100', name: 'BIST 100 Endeksi', type: 'ENDEKS' },
            { sym: 'XU030', name: 'BIST 30 Endeksi', type: 'ENDEKS' },
            { sym: 'ALTIN', name: 'Gram Altın', type: 'ALTIN' },
        ];
        MACRO_INJECT.forEach((m, idx) => {
            if (!existing.has(m.sym) && liveQuotes[m.sym]) {
                normalized.push({
                    id: 9900 + idx,
                    symbol: m.sym,
                    name: m.name,
                    asset_type: m.type,
                    current_price: formatApiPrice(liveQuotes[m.sym].price),
                    change: liveQuotes[m.sym].change,
                    positive: liveQuotes[m.sym].positive,
                });
            }
        });

        if (!query) {
            return NextResponse.json(normalized);
        }

        const cleanQ = normalizeSearchText(query);
        const queryWords = cleanQ.split(/\s+/).filter(Boolean);
        const resultMap = new Map<string, NormalizedAsset>();

        // scoreAssetMatch metni kendisi normalize eder
        const scoreAsset = (sym: string, nm: string, change?: string): number => {
            let score = scoreAssetMatch(sym, nm, query);
            if (score > 0) {
                // Bugün fiyatı hareket etmiş varlıklar öne çıksın
                const hasActiveMovement = change && change !== '0.00' && change !== '+0.00' && change !== '-0.00';
                if (hasActiveMovement) {
                    score += 2000;
                }
            }
            return score;
        };

        // 1) Veritabanındaki varlıklar
        normalized.forEach((a) => {
            if (scoreAsset(a.symbol, a.name, a.change) > 0) {
                resultMap.set(a.symbol, a);
            }
        });

        const sortedResults = (): NormalizedAsset[] => {
            // Her sonucun puanı bir kez hesaplanır
            const scores = new Map<string, number>();
            for (const a of resultMap.values()) {
                scores.set(a.symbol, scoreAsset(a.symbol, a.name, a.change));
            }
            const arr = Array.from(resultMap.values());
            arr.sort((a, b) => {
                const scoreA = scores.get(a.symbol) ?? 0;
                const scoreB = scores.get(b.symbol) ?? 0;
                if (scoreA !== scoreB) return scoreB - scoreA;
                return a.symbol.localeCompare(b.symbol);
            });
            return arr.slice(0, 10);
        };

        // Sonuçların günlük değişimini ve fiyatını güncelle
        const enrichResultsWithChanges = async (items: NormalizedAsset[]): Promise<NormalizedAsset[]> => {
            // Veritabanındaki varlıklar için backend'in hesapladığı günlük değişim (70000 ve üstü geçici id)
            const assetIds = items.map(a => a.id).filter(id => id > 0 && id < 70000);
            if (assetIds.length > 0) {
                try {
                    const changesRes = await fetch(`${BACKEND_URL}/assets/daily-changes?ids=${assetIds.join(',')}`, {
                        cache: 'no-store',
                        headers: backendHeaders,
                    });
                    if (changesRes.ok) {
                        const changesMap = await changesRes.json();
                        items.forEach(a => {
                            const val = changesMap[String(a.id)];
                            if (typeof val === 'number' && !isNaN(val)) {
                                a.change = signedChange(val);
                                a.positive = val >= 0;
                            }
                        });
                    }
                } catch {
                    // Değişim alınamazsa katalogdaki değer kalır
                }
            }

            // İlk 6 hisse için Yahoo'dan güncel fiyat; veritabanındaki fiyat birkaç dakika geride olabilir
            const hisseItems = items.filter(a => a.asset_type === 'HISSE').slice(0, 6);
            if (hisseItems.length > 0) {
                await Promise.all(hisseItems.map(async (stk) => {
                    const cached = getFreshQuote(stk.symbol);
                    if (cached && cached.price > 0) {
                        stk.current_price = formatApiPrice(cached.price);
                        stk.change = cached.change;
                        stk.positive = cached.positive;
                        return;
                    }

                    const quote = await fetchYahooChart(stk.symbol + '.IS');
                    if (quote && quote.price > 0) {
                        stk.current_price = formatApiPrice(quote.price);
                        if (quote.change) {
                            stk.change = quote.change;
                            stk.positive = quote.positive;
                        }
                        searchQuoteCache.set(stk.symbol, { quote, at: Date.now() });
                    }
                }));
            }

            // Altın, döviz ve endeksler
            const macroItems = items.filter(a => a.symbol === 'ALTIN' || a.asset_type === 'DOVIZ' || a.asset_type === 'ENDEKS' || a.asset_type === 'ALTIN');
            if (macroItems.length > 0) {
                await Promise.all(macroItems.map(async (m) => {
                    let quote = getFreshQuote(m.symbol);
                    if (!quote) {
                        if (m.symbol === 'ALTIN') {
                            quote = (await fetchSpotGold(3000)) || undefined;
                        } else if (MACRO_SYMBOLS[m.symbol]) {
                            quote = (await fetchYahooChart(MACRO_SYMBOLS[m.symbol])) || undefined;
                        }
                        if (quote) searchQuoteCache.set(m.symbol, { quote, at: Date.now() });
                    }
                    if (quote && quote.price > 0) {
                        m.current_price = formatApiPrice(quote.price);
                        m.change = quote.change;
                        m.positive = quote.positive;
                    }
                }));
            }

            return items;
        };

        // Veritabanında 5 ve üzeri sonuç varsa dış kaynaklara gitmeden dön
        if (resultMap.size >= 5) {
            const items = await enrichResultsWithChanges(sortedResults());
            return NextResponse.json(items);
        }

        // 2) TEFAS fon kataloğu
        try {
            const tefasFunds = await getTefasCatalog();
            const matched = tefasFunds.filter((f) => scoreAsset(f.symbol, f.name) > 0).slice(0, 6);

            matched.forEach((f, idx) => {
                if (!resultMap.has(f.symbol)) {
                    resultMap.set(f.symbol, {
                        id: 70000 + idx,
                        symbol: f.symbol,
                        name: f.name,
                        asset_type: 'FON',
                        current_price: formatApiPrice(f.price),
                        change: '0.00',
                        positive: true,
                    });
                }
            });
        } catch {
            // TEFAS'a ulaşılamazsa fon sonuçları eklenmez
        }

        // 3) Aranan metin bir BIST koduna benziyorsa (3-6 karakter) Yahoo'da doğrudan dene
        const probeSymbols = new Set<string>();
        const directCandidate = cleanQ.replace(/[^a-z0-9]/gi, '').toUpperCase();
        if (directCandidate.length >= 3 && directCandidate.length <= 6) probeSymbols.add(directCandidate);
        queryWords.forEach((w) => {
            const cleanW = w.replace(/[^a-z0-9]/gi, '').toUpperCase();
            if (cleanW.length >= 3 && cleanW.length <= 6) probeSymbols.add(cleanW);
        });

        await Promise.all(
            Array.from(probeSymbols).map(async (sym) => {
                if (resultMap.has(sym)) return;
                const quote = await fetchYahooChart(sym + '.IS');
                if (quote && quote.price > 0) {
                    resultMap.set(sym, {
                        id: 85000 + Math.floor(Math.random() * 5000),
                        symbol: sym,
                        name: quote.name,
                        asset_type: 'HISSE',
                        current_price: formatApiPrice(quote.price),
                        change: quote.change,
                        positive: quote.positive,
                    });
                }
            })
        );

        // 4) Yahoo metin araması; yalnızca Borsa İstanbul sonuçları alınır
        try {
            const yahooRes = await fetch(
                'https://query2.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(query) + '&quotesCount=10',
                { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(2500) }
            );
            if (yahooRes.ok) {
                const yData = await yahooRes.json();
                const istQuotes = (yData?.quotes || [])
                    .filter((q: YahooSearchQuote) => q.symbol?.endsWith('.IS') || q.exchange === 'IST')
                    .slice(0, 4);

                await Promise.all(
                    istQuotes.map(async (qItem: YahooSearchQuote, idx: number) => {
                        const sym = qItem.symbol.replace('.IS', '').toUpperCase();
                        if (resultMap.has(sym)) return;
                        const quote = await fetchYahooChart(qItem.symbol);
                        if (quote && quote.price > 0) {
                            resultMap.set(sym, {
                                id: 90000 + idx,
                                symbol: sym,
                                name: quote.name,
                                asset_type: 'HISSE',
                                current_price: formatApiPrice(quote.price),
                                change: quote.change,
                                positive: quote.positive,
                            });
                        }
                    })
                );
            }
        } catch {
            // Yahoo araması başarısız olursa eldeki sonuçlarla devam edilir
        }

        const finalItems = await enrichResultsWithChanges(sortedResults());
        return NextResponse.json(finalItems);
    } catch (err: unknown) {
        console.error('/api/assets hatası:', err);
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Backend connection failed', message: errMsg }, { status: 500 });
    }
}
