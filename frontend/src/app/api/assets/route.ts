import { NextResponse } from 'next/server';
import { normalizeSearchText, scoreAssetMatch } from '@/lib/searchUtils';

export const dynamic = 'force-dynamic';

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

interface ChartQuote {
    price: number;
    prev: number;
    change: string;
    positive: boolean;
    name: string;
}

interface RawTefasItem {
    fonKodu?: string;
    fonUnvan?: string;
    fiyat?: number;
}

interface BackendAsset {
    ID?: number;
    id?: number;
    Symbol?: string;
    symbol?: string;
    Name?: string;
    name?: string;
    AssetType?: string;
    asset_type?: string;
    CurrentPrice?: string;
    current_price?: string;
}

interface YahooSearchQuote {
    symbol: string;
    exchange?: string;
}

// Türkçe harf duyarsız ve aksan normalizasyonu (Ortak searchUtils motoru)
function cleanText(text: string): string {
    return normalizeSearchText(text);
}

function formatPrice(price: number): string {
    return price >= 100 ? price.toFixed(2) : (price >= 1 ? price.toFixed(2) : price.toFixed(4));
}

// 1. Yahoo Finance Tekil Grafik / Fiyat Çekici
async function fetchYahooChart(ticker: string): Promise<ChartQuote | null> {
    try {
        const res = await fetch(
            'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=1d',
            {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(2500),
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) return null;

        const price = Number(meta.regularMarketPrice);
        const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
        const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;

        return {
            price,
            prev,
            change: (pct >= 0 ? '+' : '') + pct.toFixed(2),
            positive: pct >= 0,
            name: meta.longName || meta.shortName || ticker,
        };
    } catch {
        return null;
    }
}

// 2. TEFAS Fon Kataloğu (60 dk Önbellek, YAT + EMK desteği, Hafta Sonu & Tatil Koruması)
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

// 3. Canlı Piyasa Alıntıları (30 sn Önbellek)
let liveQuotesCache: Record<string, ChartQuote> = {};
let lastQuotesFetchTime = 0;

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

async function fetchSpotGold(): Promise<ChartQuote | null> {
    try {
        const res = await fetch('https://finans.truncgil.com/v4/today.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return null;
        const text = await res.text();
        const m = text.match(/"GRA"\s*:\s*(\{[^}]+\})/);
        if (!m) return null;

        const gra = JSON.parse(m[1]);
        const price = Number(gra.Selling || gra.Buying || 0);
        if (price <= 0) return null;

        const changePct = Number(gra.Change || 0);
        const prev = price / (1 + changePct / 100);

        return {
            price,
            prev,
            change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2),
            positive: changePct >= 0,
            name: 'Gram Altın',
        };
    } catch {
        return null;
    }
}

async function getLiveMarketQuotes(): Promise<Record<string, ChartQuote>> {
    const now = Date.now();
    if (Object.keys(liveQuotesCache).length > 0 && now - lastQuotesFetchTime < 30 * 1000) {
        return liveQuotesCache;
    }

    const quotes: Record<string, ChartQuote> = { ...liveQuotesCache };
    const [spotGold] = await Promise.all([
        fetchSpotGold(),
        ...Object.entries(MACRO_SYMBOLS).map(async ([internalSym, yahooSym]) => {
            const q = await fetchYahooChart(yahooSym);
            if (q) quotes[internalSym] = q;
        }),
    ]);

    // Doğrudan spot piyasa Gram Altın (GAU/TRY)
    if (spotGold && spotGold.price > 0) {
        quotes['ALTIN'] = spotGold;
    } else if (quotes['GOLD_OZ'] && quotes['USDTRY']) {
        // Yedek fallback: Ons Altın * USDTRY / 31.1034768
        const goldPrice = (quotes['GOLD_OZ'].price * quotes['USDTRY'].price) / 31.1034768;
        const goldPrev = (quotes['GOLD_OZ'].prev * quotes['USDTRY'].prev) / 31.1034768;
        const pct = goldPrev > 0 ? ((goldPrice - goldPrev) / goldPrev) * 100 : 0;
        quotes['ALTIN'] = {
            price: goldPrice,
            prev: goldPrev,
            change: (pct >= 0 ? '+' : '') + pct.toFixed(2),
            positive: pct >= 0,
            name: 'Gram Altın',
        };
    }

    liveQuotesCache = quotes;
    lastQuotesFetchTime = now;
    return quotes;
}

// 3.5. Tüm Aktif Varlıkların Günlük Değişim Haritası (2 Dakika Önbellek)
let allDailyChangesCache: Record<string, number> = {};
let lastAllDailyChangesFetchTime = 0;

async function getAllDailyChanges(backendBase: string): Promise<Record<string, number>> {
    const now = Date.now();
    if (Object.keys(allDailyChangesCache).length > 0 && now - lastAllDailyChangesFetchTime < 2 * 60 * 1000) {
        return allDailyChangesCache;
    }
    try {
        const res = await fetch(`${backendBase}/assets/daily-changes`, { cache: 'no-store' });
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

// 4. GET İşleyici
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim();

        // Canlı piyasa kurları ve veritabanı varlıklarını al
        const backendBase = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

        // Arama sorgusu varsa harici makro kurları tarayarak 20-30 saniye gecikme yaratma (0 ms hızlı autocomplete)
        const [liveQuotes, backendRes, dailyChangesMap] = await Promise.all([
            !query ? getLiveMarketQuotes() : Promise.resolve({} as Record<string, ChartQuote>),
            fetch(`${backendBase}/assets`, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' },
            }).catch(() => null),
            getAllDailyChanges(backendBase),
        ]);

        const rawData: BackendAsset[] = (backendRes?.ok && await backendRes.json().catch(() => [])) || [];

        // Varlıkları normalize et & borsada işlem görmeyen (geçmiş fiyatı ve günlük değişimi olmayan) kapalı fonları filtrele
        const normalized: NormalizedAsset[] = (Array.isArray(rawData) ? rawData : [])
            .filter((item: BackendAsset) => {
                const assetType = String(item.AssetType ?? item.asset_type ?? 'HISSE').trim().toUpperCase();
                const idStr = String(item.ID ?? item.id ?? 0);
                // Borsada işlem görmeyen Girişim Sermayesi (GSYF), Gayrimenkul (GMYF) veya değişimi %0.00 olan durağan fonları güvenle gizle
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
                
                // Önceden hesaplanmış gerçek günlük değişim yüzdesi
                let change = '0.00';
                let positive = true;
                const dbChange = dailyChangesMap[String(id)];
                if (typeof dbChange === 'number' && !isNaN(dbChange)) {
                    change = (dbChange >= 0 ? '+' : '') + dbChange.toFixed(2);
                    positive = dbChange >= 0;
                }

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
                    current_price: formatPrice(price),
                    change,
                    positive,
                };
            });

        // Veritabanında henüz olmayan temel makro varlıkları (Döviz, BIST 100, Altın) ekle
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
                    current_price: formatPrice(liveQuotes[m.sym].price),
                    change: liveQuotes[m.sym].change,
                    positive: liveQuotes[m.sym].positive,
                });
            }
        });

        // Arama yoksa tüm kataloğu dön
        if (!query) {
            return NextResponse.json(normalized);
        }

        const cleanQ = cleanText(query);
        const queryWords = cleanQ.split(/\s+/).filter(Boolean);
        const resultMap = new Map<string, NormalizedAsset>();

        // Finansal varlık alaka düzeyi puanlama fonksiyonu (searchUtils Relevance Scoring Engine)
        const scoreAsset = (sym: string, nm: string, change?: string): number => {
            let score = scoreAssetMatch(sym, nm, cleanQ);
            if (score > 0) {
                // Canlı, dünden bugüne işlem gören (değişimi %0.00 olmayan) hareketli varlıklara +2000 öncelik bonusu
                const hasActiveMovement = change && change !== '0.00' && change !== '+0.00' && change !== '-0.00';
                if (hasActiveMovement) {
                    score += 2000;
                }
            }
            return score;
        };

        // 1. Veritabanından ara (Alaka puanı > 0 olanları topla)
        normalized.forEach((a) => {
            const sym = cleanText(a.symbol);
            const nm = cleanText(a.name);
            const score = scoreAsset(sym, nm, a.change);
            if (score > 0) {
                resultMap.set(a.symbol, a);
            }
        });

        const sortedResults = (): NormalizedAsset[] => {
            const arr = Array.from(resultMap.values());
            arr.sort((a, b) => {
                const scoreA = scoreAsset(cleanText(a.symbol), cleanText(a.name), a.change);
                const scoreB = scoreAsset(cleanText(b.symbol), cleanText(b.name), b.change);
                if (scoreA !== scoreB) return scoreB - scoreA;
                return a.symbol.localeCompare(b.symbol);
            });
            return arr.slice(0, 10);
        };

        // Sonuçları gerçek günlük yüzdelerle (price_history dünden bugüne değişim) zenginleştir
        const enrichResultsWithChanges = async (items: NormalizedAsset[]): Promise<NormalizedAsset[]> => {
            const assetIds = items.map(a => a.id).filter(id => id > 0 && id < 70000);
            if (assetIds.length > 0) {
                try {
                    const changesRes = await fetch(`${backendBase}/assets/daily-changes?ids=${assetIds.join(',')}`, { cache: 'no-store' });
                    if (changesRes.ok) {
                        const changesMap = await changesRes.json();
                        items.forEach(a => {
                            const val = changesMap[String(a.id)];
                            if (typeof val === 'number' && !isNaN(val)) {
                                a.change = (val >= 0 ? '+' : '') + val.toFixed(2);
                                a.positive = val >= 0;
                            }
                        });
                    }
                } catch {
                    // Sessiz hata yönetimi
                }
            }

            // BIST Hisseleri için canlı Yahoo Finance fiyat ve günlük değişim zenginleştirmesi
            // Veritabanındaki bayat kalmış fiyatları ve eski tavan/taban yüzdelerini anlık canlı verilerle yeniler
            const hisseItems = items.filter(a => a.asset_type === 'HISSE').slice(0, 6);
            if (hisseItems.length > 0) {
                await Promise.all(hisseItems.map(async (stk) => {
                    const cached = liveQuotesCache[stk.symbol];
                    if (cached && cached.price > 0) {
                        stk.current_price = formatPrice(cached.price);
                        stk.change = cached.change;
                        stk.positive = cached.positive;
                        return;
                    }

                    const quote = await fetchYahooChart(stk.symbol + '.IS');
                    if (quote && quote.price > 0) {
                        stk.current_price = formatPrice(quote.price);
                        if (quote.change) {
                            stk.change = quote.change;
                            stk.positive = quote.positive;
                        }
                        liveQuotesCache[stk.symbol] = quote;
                    }
                }));
            }

            // Makro varlıklar (ALTIN, Döviz, Endeks) için canlı piyasa kurları ile anlık zenginleştirme
            const macroItems = items.filter(a => a.symbol === 'ALTIN' || a.asset_type === 'DOVIZ' || a.asset_type === 'ENDEKS' || a.asset_type === 'ALTIN');
            if (macroItems.length > 0) {
                await Promise.all(macroItems.map(async (m) => {
                    let quote: ChartQuote | undefined = liveQuotesCache[m.symbol];
                    if (!quote) {
                        if (m.symbol === 'ALTIN') {
                            quote = (await fetchSpotGold()) || undefined;
                        } else if (MACRO_SYMBOLS[m.symbol]) {
                            quote = (await fetchYahooChart(MACRO_SYMBOLS[m.symbol])) || undefined;
                        }
                        if (quote) liveQuotesCache[m.symbol] = quote;
                    }
                    if (quote && quote.price > 0) {
                        m.current_price = formatPrice(quote.price);
                        m.change = quote.change;
                        m.positive = quote.positive;
                    }
                }));
            }

            return items;
        };

        // Veritabanında yeterli sonuç bulunduysa dış ağ beklemeden anında dön (Hızlı Autocomplete)
        if (resultMap.size >= 5) {
            const items = await enrichResultsWithChanges(sortedResults());
            return NextResponse.json(items);
        }

        // 2. TEFAS fon kataloğunda ara (Bellekteki 2000+ fondan)
        try {
            const tefasFunds = await getTefasCatalog();
            const matched = tefasFunds.filter((f) => {
                const c = cleanText(f.symbol);
                const n = cleanText(f.name);
                return scoreAsset(c, n) > 0;
            }).slice(0, 6);

            matched.forEach((f, idx) => {
                if (!resultMap.has(f.symbol)) {
                    resultMap.set(f.symbol, {
                        id: 70000 + idx,
                        symbol: f.symbol,
                        name: f.name,
                        asset_type: 'FON',
                        current_price: formatPrice(f.price),
                        change: '0.00',
                        positive: true,
                    });
                }
            });
        } catch {
            // TEFAS hata yutulur
        }

        // 3. Borsa İstanbul Doğrudan Yoklama & Yahoo Araması
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
                        current_price: formatPrice(quote.price),
                        change: quote.change,
                        positive: quote.positive,
                    });
                }
            })
        );

        // Genel Yahoo metin araması
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
                                current_price: formatPrice(quote.price),
                                change: quote.change,
                                positive: quote.positive,
                            });
                        }
                    })
                );
            }
        } catch {
            // Yahoo arama hatası yutulur
        }

        const finalItems = await enrichResultsWithChanges(sortedResults());
        return NextResponse.json(finalItems);
    } catch (err: unknown) {
        console.error('Next.js API assets proxy error:', err);
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Backend connection failed', message: errMsg }, { status: 500 });
    }
}
