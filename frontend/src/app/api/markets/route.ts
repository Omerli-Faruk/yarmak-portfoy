import { NextResponse } from 'next/server';
import { scoreAssetMatch } from '@/lib/searchUtils';

export const dynamic = 'force-dynamic';

interface MarketIndexItem {
    symbol: string;
    name: string;
    price: number;
    change: string;
    positive: boolean;
}

interface MarketAssetItem {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    price: number;
    change: string;
    change_value: number;
    positive: boolean;
    volume?: string;
    sparkline?: number[];
}

interface ChartQuote {
    price: number;
    prev: number;
    change: string;
    positive: boolean;
    name: string;
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
    Change?: string | number;
}

interface MarketData {
    indices: MarketIndexItem[];
    topGainers: MarketAssetItem[];
    topLosers: MarketAssetItem[];
    mostActive: MarketAssetItem[];
    allItems: MarketAssetItem[];
}

// 30 saniyelik bellek önbelleği
let marketCache: {
    data: MarketData;
    timestamp: number;
} | null = null;

// Yahoo Crumb / Cookie Önbelleği (1 saat)
let yahooCookieCache = '';
let yahooCrumbCache = '';
let yahooCrumbExpiry = 0;

async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
    const now = Date.now();
    if (yahooCookieCache && yahooCrumbCache && now < yahooCrumbExpiry) {
        return { cookie: yahooCookieCache, crumb: yahooCrumbCache };
    }
    try {
        const r1 = await fetch('https://fc.yahoo.com', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3500)
        });
        const cookie = r1.headers.get('set-cookie');
        if (!cookie) return null;

        const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie },
            signal: AbortSignal.timeout(3500)
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

// BIST Hisseleri Canlı Toplu Fiyat Çekici (Yahoo Quote v7)
async function fetchBistLiveQuotes(symbols: string[]): Promise<Map<string, { price: number; changePercent: number; volume?: number; name?: string }>> {
    const map = new Map<string, { price: number; changePercent: number; volume?: number; name?: string }>();
    if (symbols.length === 0) return map;

    const auth = await getYahooAuth();
    if (!auth) return map;

    const chunkSize = 120;
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += chunkSize) {
        chunks.push(symbols.slice(i, i + chunkSize));
    }

    await Promise.all(chunks.map(async chunk => {
        try {
            const querySymbols = chunk.map(s => (s.endsWith('.IS') ? s : `${s}.IS`)).join(',');
            const res = await fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${querySymbols}&crumb=${auth.crumb}`, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': auth.cookie },
                signal: AbortSignal.timeout(4500)
            });
            if (!res.ok) return;
            const data = await res.json();
            const results = data?.quoteResponse?.result || [];
            for (const item of results) {
                const sym = item.symbol.replace('.IS', '').toUpperCase();
                const price = Number(item.regularMarketPrice || item.price || 0);
                const changePct = Number(item.regularMarketChangePercent ?? item.changePercent ?? 0);
                if (price > 0) {
                    map.set(sym, {
                        price,
                        changePercent: changePct,
                        volume: item.regularMarketVolume,
                        name: item.shortName || item.longName,
                    });
                }
            }
        } catch {
            // chunk hatası sessizce geçilir
        }
    }));

    return map;
}

function formatVolume(vol?: number): string {
    if (!vol || vol <= 0) return '-';
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + ' Mr';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + ' M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(1) + ' B';
    return vol.toLocaleString('tr-TR');
}

// Spot Gram Altın (Kapalıçarşı Serbest Piyasa)
async function fetchSpotGold(): Promise<ChartQuote | null> {
    try {
        const res = await fetch('https://finans.truncgil.com/v4/today.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3500),
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

// Yahoo Finance Tekil Veri Çekici
async function fetchYahooQuote(ticker: string, customName?: string): Promise<ChartQuote | null> {
    try {
        const res = await fetch(
            'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=5d',
            {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(3500),
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
            name: customName || meta.longName || meta.shortName || ticker,
        };
    } catch {
        return null;
    }
}

const POPULAR_BIST_SYMBOLS = [
    'THYAO', 'ASELS', 'TUPRS', 'EREGL', 'GARAN',
    'AKBNK', 'ISCTR', 'KCHOL', 'BIMAS', 'SAHOL',
    'SISE', 'FROTO', 'SASA', 'ASTOR', 'EKGYO'
];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = (searchParams.get('category') || 'ALL').toUpperCase(); // ALL, HISSE, FON, EMTIA
        const sort = searchParams.get('sort') || 'gainers'; // gainers, losers, popular, alpha
        const search = (searchParams.get('search') || '').trim().toLowerCase();
        const period = (searchParams.get('period') || '1D').toUpperCase();

        const now = Date.now();
        const backendBase = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

        // 1. Önbellek geçerli ise doğrudan kullan (30 saniye boyunca sıfır gecikme ile filtrele)
        if (marketCache && (now - marketCache.timestamp < 30 * 1000)) {
            return formatResponse(marketCache.data, category, sort, period, search);
        }

        // 2. Canlı Makro Endeksler ve Backend Verilerini Paralel Çek
        const [
            spotGold,
            xu100,
            xu030,
            usdTry,
            eurTry,
            backendAssetsRes,
            dailyChangesRes
        ] = await Promise.all([
            fetchSpotGold(),
            fetchYahooQuote('XU100.IS', 'BIST 100'),
            fetchYahooQuote('XU030.IS', 'BIST 30'),
            fetchYahooQuote('USDTRY=X', 'Dolar / TL'),
            fetchYahooQuote('EURTRY=X', 'Euro / TL'),
            fetch(`${backendBase}/assets`, { cache: 'no-store' }).catch(() => null),
            fetch(`${backendBase}/assets/daily-changes`, { cache: 'no-store' }).catch(() => null),
        ]);

        const rawAssets: BackendAsset[] = (backendAssetsRes?.ok && await backendAssetsRes.json().catch(() => [])) || [];
        const dailyChangesMap: Record<string, number> = (dailyChangesRes?.ok && await dailyChangesRes.json().catch(() => ({}))) || {};

        // BIST hisse sembollerini topla ve Yahoo Finance'den toplu canlı fiyatları çek
        const bistSymbols = rawAssets
            .filter(item => {
                const at = String(item.AssetType ?? item.asset_type ?? 'HISSE').toUpperCase();
                return at === 'HISSE';
            })
            .map(item => String(item.Symbol ?? item.symbol ?? '').toUpperCase().trim())
            .filter(Boolean);

        const liveBistQuotes = await fetchBistLiveQuotes(bistSymbols);

        // Endeks Kartları
        const indices: MarketIndexItem[] = [
            {
                symbol: 'XU100',
                name: 'BIST 100',
                price: xu100?.price || 0,
                change: xu100?.change || '0.00',
                positive: xu100 ? xu100.positive : true,
            },
            {
                symbol: 'XU030',
                name: 'BIST 30',
                price: xu030?.price || 0,
                change: xu030?.change || '0.00',
                positive: xu030 ? xu030.positive : true,
            },
            {
                symbol: 'ALTIN',
                name: 'Gram Altın',
                price: spotGold?.price || 0,
                change: spotGold?.change || '0.00',
                positive: spotGold ? spotGold.positive : true,
            },
            {
                symbol: 'USDTRY',
                name: 'Dolar / TL',
                price: usdTry?.price || 0,
                change: usdTry?.change || '0.00',
                positive: usdTry ? usdTry.positive : true,
            },
            {
                symbol: 'EURTRY',
                name: 'Euro / TL',
                price: eurTry?.price || 0,
                change: eurTry?.change || '0.00',
                positive: eurTry ? eurTry.positive : true,
            }
        ];

        // Varlıkları normalize et (Tekilleştirilmiş Map kullanarak tekrarları tamamen engelle)
        const itemsMap = new Map<string, MarketAssetItem>();

        // BIST, TEFAS, Altın ve Döviz varlıklarını backend kayıtları ile harmanla
        for (const item of rawAssets) {
            const id = Number(item.ID ?? item.id ?? 0);
            const symbol = String(item.Symbol ?? item.symbol ?? '').trim().toUpperCase();
            let name = String(item.Name ?? item.name ?? symbol).trim();
            let assetType = String(item.AssetType ?? item.asset_type ?? 'HISSE').trim().toUpperCase();
            
            let price = parseFloat(item.CurrentPrice ?? item.current_price ?? '0') || 0;
            let changeVal = 0;
            let volumeStr: string | undefined = undefined;

            if (itemsMap.has(symbol)) continue;

            if (symbol === 'ALTIN' || assetType === 'ALTIN') {
                assetType = 'ALTIN';
                name = 'Gram Altın';
                if (spotGold && spotGold.price > 0) {
                    price = spotGold.price;
                    changeVal = parseFloat(spotGold.change) || 0;
                }
            } else if (symbol === 'USDTRY' || symbol === 'USD/TRY') {
                assetType = 'DOVIZ';
                name = 'Amerikan Doları';
                if (usdTry && usdTry.price > 0) {
                    price = usdTry.price;
                    changeVal = parseFloat(usdTry.change) || 0;
                }
            } else if (symbol === 'EURTRY' || symbol === 'EUR/TRY') {
                assetType = 'DOVIZ';
                name = 'Euro';
                if (eurTry && eurTry.price > 0) {
                    price = eurTry.price;
                    changeVal = parseFloat(eurTry.change) || 0;
                }
            } else if (assetType === 'HISSE') {
                const liveQuote = liveBistQuotes.get(symbol);
                if (liveQuote && liveQuote.price > 0) {
                    price = liveQuote.price;
                    changeVal = Math.round(liveQuote.changePercent * 100) / 100;
                    if (liveQuote.volume) {
                        volumeStr = formatVolume(liveQuote.volume);
                    }
                    if (liveQuote.name) {
                        name = liveQuote.name;
                    }
                } else {
                    const idStr = String(id);
                    if (dailyChangesMap[idStr] !== undefined) {
                        changeVal = dailyChangesMap[idStr];
                    } else if (item.Change !== undefined && item.Change !== '') {
                        changeVal = parseFloat(String(item.Change).replace('+', '')) || 0;
                    }
                }
            } else if (assetType === 'FON') {
                const idStr = String(id);
                if (dailyChangesMap[idStr] !== undefined) {
                    changeVal = dailyChangesMap[idStr];
                } else if (item.Change !== undefined && item.Change !== '') {
                    changeVal = parseFloat(String(item.Change).replace('+', '')) || 0;
                }
                // TEFAS fonlarında bölünme veya scraping anomalisini filtrele (+-25% üzeri anomali)
                if (Math.abs(changeVal) > 25) {
                    changeVal = 0;
                }
            }

            if (price <= 0 || !symbol) continue;

            const isPos = changeVal >= 0;
            const changeStr = `${isPos ? '+' : ''}${changeVal.toFixed(2)}%`;

            itemsMap.set(symbol, {
                id,
                symbol,
                name,
                asset_type: assetType,
                price,
                change: changeStr,
                change_value: changeVal,
                positive: isPos,
                volume: volumeStr,
            });
        }

        // Eğer backend'de ALTIN, USDTRY veya EURTRY tanımlı değilse canlı verilerden tamamla
        if (!itemsMap.has('ALTIN') && spotGold && spotGold.price > 0) {
            itemsMap.set('ALTIN', {
                id: -1,
                symbol: 'ALTIN',
                name: 'Gram Altın',
                asset_type: 'ALTIN',
                price: spotGold.price,
                change: spotGold.change,
                change_value: parseFloat(spotGold.change) || 0,
                positive: spotGold.positive,
            });
        }
        if (!itemsMap.has('USDTRY') && usdTry && usdTry.price > 0) {
            itemsMap.set('USDTRY', {
                id: -2,
                symbol: 'USDTRY',
                name: 'Amerikan Doları',
                asset_type: 'DOVIZ',
                price: usdTry.price,
                change: usdTry.change,
                change_value: parseFloat(usdTry.change) || 0,
                positive: usdTry.positive,
            });
        }
        if (!itemsMap.has('EURTRY') && eurTry && eurTry.price > 0) {
            itemsMap.set('EURTRY', {
                id: -3,
                symbol: 'EURTRY',
                name: 'Euro',
                asset_type: 'DOVIZ',
                price: eurTry.price,
                change: eurTry.change,
                change_value: parseFloat(eurTry.change) || 0,
                positive: eurTry.positive,
            });
        }

        const allItems = Array.from(itemsMap.values());

        // =====================================================================
        // KRİTİK KURAL: GÜNÜN YÜKSELENLERİ, DÜŞENLERİ VE POPÜLERLERİ
        // KESİNLİKLE VE SADECE BIST HİSSELERİNDEN OLUŞMALIDIR (FON YOK!)
        // =====================================================================
        const stocksOnly = allItems.filter(
            x => x.asset_type === 'HISSE' && x.price > 0 && Math.abs(x.change_value) <= 10.5
        );

        // Top Gainers (En çok yükselen BIST hisseleri - SADECE HİSSE)
        const topGainers = [...stocksOnly]
            .filter(x => x.change_value > 0)
            .sort((a, b) => b.change_value - a.change_value)
            .slice(0, 5);

        // Top Losers (En çok düşen BIST hisseleri - SADECE HİSSE)
        const topLosers = [...stocksOnly]
            .filter(x => x.change_value < 0)
            .sort((a, b) => a.change_value - b.change_value)
            .slice(0, 5);

        // Most Popular (Günün Popüler BIST hisseleri - SADECE HİSSE)
        const mostActive = [...stocksOnly]
            .filter(x => POPULAR_BIST_SYMBOLS.includes(x.symbol))
            .sort((a, b) => POPULAR_BIST_SYMBOLS.indexOf(a.symbol) - POPULAR_BIST_SYMBOLS.indexOf(b.symbol))
            .slice(0, 5);

        const fullData = {
            indices,
            topGainers,
            topLosers,
            mostActive,
            allItems,
        };

        marketCache = {
            data: fullData,
            timestamp: now,
        };

        return formatResponse(fullData, category, sort, period, search);
    } catch (err: unknown) {
        console.error('Markets API error:', err);
        return NextResponse.json({ error: 'Piyasa verileri alınamadı' }, { status: 500 });
    }
}

function formatResponse(
    fullData: MarketData,
    category: string,
    sort: string,
    period: string,
    search: string
) {
    let filtered = [...(fullData.allItems || [])];

    // 1. Kategori Filtresi
    if (category === 'HISSE') {
        filtered = filtered.filter(x => x.asset_type === 'HISSE');
    } else if (category === 'FON') {
        filtered = filtered.filter(x => x.asset_type === 'FON');
    } else if (category === 'EMTIA') {
        filtered = filtered.filter(x => x.asset_type === 'ALTIN' || x.asset_type === 'DOVIZ');
    }

    // 2. Arama & Benzerlik Filtresi (Relevance & Fuzzy Matching)
    if (search) {
        const scoredItems: { item: MarketAssetItem; score: number }[] = [];
        for (const item of filtered) {
            const score = scoreAssetMatch(item.symbol, item.name, search);
            if (score > 0) {
                scoredItems.push({ item, score });
            }
        }

        // Arama yapıldığında birincil öncelik alaka ve benzerlik puanıdır:
        // Tam ve başlayan eşleşmeler en üstte, benzer olanlar aşağıda sıralanır.
        scoredItems.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            if (sort === 'gainers') return b.item.change_value - a.item.change_value;
            if (sort === 'losers') return a.item.change_value - b.item.change_value;
            if (sort === 'alpha') return a.item.symbol.localeCompare(b.item.symbol);
            return 0;
        });

        filtered = scoredItems.map(x => x.item);
    } else {
        // 3. Sıralama (Arama yokken kullanıcının seçtiği sıralama ölçütü)
        if (sort === 'gainers') {
            filtered.sort((a, b) => b.change_value - a.change_value);
        } else if (sort === 'losers') {
            filtered.sort((a, b) => a.change_value - b.change_value);
        } else if (sort === 'alpha') {
            filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
        } else if (sort === 'popular') {
            const popSet = new Set(POPULAR_BIST_SYMBOLS);
            filtered.sort((a, b) => {
                const aPop = popSet.has(a.symbol);
                const bPop = popSet.has(b.symbol);
                if (aPop && !bPop) return -1;
                if (!aPop && bPop) return 1;
                return b.change_value - a.change_value;
            });
        }
    }

    return NextResponse.json({
        indices: fullData.indices || [],
        topGainers: fullData.topGainers || [],
        topLosers: fullData.topLosers || [],
        mostActive: fullData.mostActive || [],
        screener: filtered.slice(0, 100), // İlk 100 varlık
        totalCount: filtered.length,
    });
}
