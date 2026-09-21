import { NextResponse } from 'next/server';

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

// Türkçe harf duyarsız normalizasyon
function cleanText(text: string): string {
    return (text || '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .trim();
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

// 2. TEFAS Fon Kataloğu (30 dk Önbellek)
let tefasCatalogCache: TefasFundItem[] = [];
let lastTefasFetchTime = 0;

async function getTefasCatalog(): Promise<TefasFundItem[]> {
    const now = Date.now();
    if (tefasCatalogCache.length > 0 && now - lastTefasFetchTime < 30 * 60 * 1000) {
        return tefasCatalogCache;
    }

    try {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const res = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://www.tefas.gov.tr',
                'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
                'User-Agent': 'Mozilla/5.0',
            },
            body: JSON.stringify({
                fonTipi: 'YAT',
                basTarih: today,
                bitTarih: today,
                basSira: 1,
                bitSira: 5000,
                dil: 'TR',
            }),
            signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.resultList) && data.resultList.length > 0) {
                tefasCatalogCache = data.resultList.map((item: any) => ({
                    symbol: String(item.fonKodu || '').toUpperCase(),
                    name: String(item.fonUnvan || ''),
                    price: Number(item.fiyat || 0),
                }));
                lastTefasFetchTime = now;
            }
        }
    } catch (err) {
        console.warn('TEFAS katalog uyarısı:', err);
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

// 4. GET İşleyici
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim();

        // Canlı piyasa kurları ve veritabanı varlıklarını al
        const backendBase = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

        const [liveQuotes, backendRes] = await Promise.all([
            getLiveMarketQuotes(),
            fetch(`${backendBase}/assets`, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' },
            }).catch(() => null),
        ]);

        const rawData: any[] = (backendRes?.ok && await backendRes.json().catch(() => [])) || [];

        // Varlıkları normalize et
        const normalized: NormalizedAsset[] = (Array.isArray(rawData) ? rawData : []).map((item: any) => {
            const symbol = String(item.Symbol ?? item.symbol ?? '').trim().toUpperCase();
            const name = String(item.Name ?? item.name ?? symbol).trim();
            const assetType = String(item.AssetType ?? item.asset_type ?? 'HISSE').trim().toUpperCase();
            let price = parseFloat(item.CurrentPrice ?? item.current_price ?? '0');
            let change = '0.00';
            let positive = true;

            const live = liveQuotes[symbol];
            if (live && live.price > 0) {
                price = live.price;
                change = live.change;
                positive = live.positive;
            }

            return {
                id: Number(item.ID ?? item.id ?? 0),
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

        // 1. Veritabanından ara (Sembol, isim veya çoklu kelime eşleşmesi)
        normalized.forEach((a) => {
            const sym = cleanText(a.symbol);
            const nm = cleanText(a.name);
            if (
                sym.includes(cleanQ) ||
                nm.includes(cleanQ) ||
                (cleanQ.includes(sym) && sym.length >= 3) ||
                (queryWords.length > 1 && queryWords.every((w) => sym.includes(w) || nm.includes(w)))
            ) {
                resultMap.set(a.symbol, a);
            }
        });

        // Veritabanında yeterli sonuç bulunduysa dış ağ beklemeden anında dön (Hızlı Autocomplete)
        if (resultMap.size >= 5) {
            const sortedResults = () => {
            const arr = Array.from(resultMap.values());
            arr.sort((a, b) => {
                const aExact = cleanText(a.symbol) === cleanQ;
                const bExact = cleanText(b.symbol) === cleanQ;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            });
            return arr.slice(0, 10);
        };
        return NextResponse.json(sortedResults());
        }

        // 2. TEFAS fon kataloğunda ara (Bellekteki 2000+ fondan)
        try {
            const tefasFunds = await getTefasCatalog();
            const matched = tefasFunds.filter((f) => {
                const c = cleanText(f.symbol);
                const n = cleanText(f.name);
                return c === cleanQ || c.includes(cleanQ) || n.includes(cleanQ);
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
                    .filter((q: any) => q.symbol?.endsWith('.IS') || q.exchange === 'IST')
                    .slice(0, 4);

                await Promise.all(
                    istQuotes.map(async (qItem: any, idx: number) => {
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

        const sortedResults = () => {
            const arr = Array.from(resultMap.values());
            arr.sort((a, b) => {
                const aExact = cleanText(a.symbol) === cleanQ;
                const bExact = cleanText(b.symbol) === cleanQ;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            });
            return arr.slice(0, 10);
        };
        return NextResponse.json(sortedResults());
    } catch (err: any) {
        console.error('Next.js API assets proxy error:', err);
        return NextResponse.json({ error: 'Backend connection failed', message: err?.message }, { status: 500 });
    }
}
