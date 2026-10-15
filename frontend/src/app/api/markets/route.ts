import { NextResponse } from 'next/server';
import { scoreAssetMatch } from '@/lib/searchUtils';
import {
    BACKEND_URL,
    type BackendAsset,
    clientIpHeader,
    fetchSpotGold,
    fetchYahooChart,
    getYahooAuth,
    gramGoldFromOunce,
    signedChange,
} from '@/lib/marketData';
import type { MarketAssetItem, MarketIndexItem } from '@/types';

export const dynamic = 'force-dynamic';

interface MarketData {
    indices: MarketIndexItem[];
    topGainers: MarketAssetItem[];
    topLosers: MarketAssetItem[];
    mostActive: MarketAssetItem[];
    allItems: MarketAssetItem[];
}

// Tüm piyasa verisi bellekte tutulur; filtre ve sıralama her istekte bunun üzerinden yapılır.
let marketCache: {
    data: MarketData;
    timestamp: number;
} | null = null;

// BIST hisselerinin fiyatlarını Yahoo v7 quote ucundan toplu çeker (veri gecikmelidir)
async function fetchBistLiveQuotes(symbols: string[]): Promise<Map<string, { price: number; changePercent: number; volume?: number; name?: string }>> {
    const map = new Map<string, { price: number; changePercent: number; volume?: number; name?: string }>();
    if (symbols.length === 0) return map;

    const auth = await getYahooAuth(3500);
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
            // Bu parça alınamazsa o hisseler veritabanı fiyatıyla gösterilir
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

// Endeks ve kurlar için günlük değişim: range '1d' ile önceki kapanış bir önceki seansın kapanışıdır
function fetchDailyQuote(ticker: string, name: string) {
    return fetchYahooChart(ticker, { range: '1d', timeoutMs: 3500, name });
}

// Sabit bir seçki; ölçülmüş bir popülerlik verisi değildir
const POPULAR_BIST_SYMBOLS = [
    'THYAO', 'ASELS', 'TUPRS', 'EREGL', 'GARAN',
    'AKBNK', 'ISCTR', 'KCHOL', 'BIMAS', 'SAHOL',
    'SISE', 'FROTO', 'SASA', 'ASTOR', 'EKGYO'
];

// Önbellek süresi seansa göre değişir: BIST seansı içinde (hafta içi 10:00-18:15) 60 sn, dışında 15 dk
function getMarketCacheTTL(): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Istanbul',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
        weekday: 'short',
    }).formatToParts(new Date());
    let hour = 12;
    let minute = 0;
    let weekday = 'Wed';
    for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'weekday') weekday = p.value;
    }
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const totalMinutes = hour * 60 + minute;
    const isTradingHours = !isWeekend && totalMinutes >= 600 && totalMinutes <= 1095;
    return isTradingHours ? 60 * 1000 : 15 * 60 * 1000;
}

// Bir endeks ya da kur alınamadıysa (fiyatı 0) önbellek tam süre beklenmeden 30 sn sonra yenilenir
const INCOMPLETE_CACHE_TTL = 30 * 1000;

function getCacheTTL(data: MarketData): number {
    const complete = data.indices.every(i => i.price > 0);
    return complete ? getMarketCacheTTL() : Math.min(INCOMPLETE_CACHE_TTL, getMarketCacheTTL());
}

let isRefreshingMarkets = false;

async function fetchFreshMarketData(backendHeaders: Record<string, string>): Promise<MarketData> {
    const [
        truncgilGold,
        goldOz,
        xu100,
        xu030,
        usdTry,
        eurTry,
        backendAssetsRes,
        dailyChangesRes
    ] = await Promise.all([
        fetchSpotGold(3500),
        fetchDailyQuote('GC=F', 'Altın (ons)'),
        fetchDailyQuote('XU100.IS', 'BIST 100'),
        fetchDailyQuote('XU030.IS', 'BIST 30'),
        fetchDailyQuote('USDTRY=X', 'Dolar / TL'),
        fetchDailyQuote('EURTRY=X', 'Euro / TL'),
        fetch(`${BACKEND_URL}/assets`, { cache: 'no-store', headers: backendHeaders }).catch(() => null),
        fetch(`${BACKEND_URL}/assets/daily-changes`, { cache: 'no-store', headers: backendHeaders }).catch(() => null),
    ]);

    // truncgil'e ulaşılamazsa gram altın ons fiyatı ve kurdan hesaplanır
    const spotGold = truncgilGold || gramGoldFromOunce(goldOz, usdTry);

    const rawAssets: BackendAsset[] = (backendAssetsRes?.ok && await backendAssetsRes.json().catch(() => [])) || [];
    const dailyChangesMap: Record<string, number> = (dailyChangesRes?.ok && await dailyChangesRes.json().catch(() => ({}))) || {};

    // Veritabanındaki BIST hisselerinin güncel fiyatlarını Yahoo'dan toplu çek
    const bistSymbols = rawAssets
        .filter(item => {
            const at = String(item.AssetType ?? item.asset_type ?? 'HISSE').toUpperCase();
            return at === 'HISSE';
        })
        .map(item => String(item.Symbol ?? item.symbol ?? '').toUpperCase().trim())
        .filter(Boolean);

    const liveBistQuotes = await fetchBistLiveQuotes(bistSymbols);

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

    // Sembole göre tekilleştirilmiş varlık listesi; fiyat ve değişim varlık türüne göre farklı kaynaktan gelir
    const itemsMap = new Map<string, MarketAssetItem>();

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
            // Fonlarda ±%25'i aşan günlük değişim büyük olasılıkla bölünme ya da veri hatasıdır; 0 gösterilir
            if (Math.abs(changeVal) > 25) {
                changeVal = 0;
            }
        }

        if (price <= 0 || !symbol) continue;

        const isPos = changeVal >= 0;
        const changeStr = `${signedChange(changeVal)}%`;

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

    // ALTIN, USDTRY veya EURTRY veritabanında yoksa dış kaynaktan gelen fiyatla ekle
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

    // Yükselen, düşen ve seçili listeler yalnızca BIST hisselerinden oluşur (fonlar girmez).
    // ±%10,5'i aşan değişimler veri hatası sayılıp listelere alınmaz.
    const stocksOnly = allItems.filter(
        x => x.asset_type === 'HISSE' && x.price > 0 && Math.abs(x.change_value) <= 10.5
    );

    const topGainers = [...stocksOnly]
        .filter(x => x.change_value > 0)
        .sort((a, b) => b.change_value - a.change_value)
        .slice(0, 5);

    const topLosers = [...stocksOnly]
        .filter(x => x.change_value < 0)
        .sort((a, b) => a.change_value - b.change_value)
        .slice(0, 5);

    const mostActive = [...stocksOnly]
        .filter(x => POPULAR_BIST_SYMBOLS.includes(x.symbol))
        .sort((a, b) => POPULAR_BIST_SYMBOLS.indexOf(a.symbol) - POPULAR_BIST_SYMBOLS.indexOf(b.symbol))
        .slice(0, 5);

    return {
        indices,
        topGainers,
        topLosers,
        mostActive,
        allItems,
    };
}

// Eskimiş önbelleği arka planda yeniler; aynı anda tek yenileme çalışır
async function refreshMarketsInBackground(backendHeaders: Record<string, string>) {
    if (isRefreshingMarkets) return;
    isRefreshingMarkets = true;
    try {
        marketCache = { data: await fetchFreshMarketData(backendHeaders), timestamp: Date.now() };
    } catch (err) {
        console.error('Piyasa verisi arka planda yenilenemedi:', err);
    } finally {
        isRefreshingMarkets = false;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = (searchParams.get('category') || 'ALL').toUpperCase(); // ALL, HISSE, FON, EMTIA
        const sort = searchParams.get('sort') || 'gainers'; // gainers, losers, popular, alpha
        // Benzerlik puanı her varlık için hesaplandığı için çok uzun aramaları kesiyoruz
        const search = (searchParams.get('search') || '').trim().slice(0, 50).toLowerCase();
        const period = (searchParams.get('period') || '1D').toUpperCase();
        const backendHeaders = clientIpHeader(request);

        // Önbellek varsa hemen döner; süresi dolmuşsa yenisi arka planda çekilir
        if (marketCache) {
            if (Date.now() - marketCache.timestamp >= getCacheTTL(marketCache.data)) {
                void refreshMarketsInBackground(backendHeaders);
            }
            return formatResponse(marketCache.data, category, sort, period, search);
        }

        // İlk istekte önbellek boş olduğu için veri beklenerek çekilir
        const fullData = await fetchFreshMarketData(backendHeaders);
        marketCache = { data: fullData, timestamp: Date.now() };
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

    if (category === 'HISSE') {
        filtered = filtered.filter(x => x.asset_type === 'HISSE');
    } else if (category === 'FON') {
        filtered = filtered.filter(x => x.asset_type === 'FON');
    } else if (category === 'EMTIA') {
        filtered = filtered.filter(x => x.asset_type === 'ALTIN' || x.asset_type === 'DOVIZ');
    }

    if (search) {
        const scoredItems: { item: MarketAssetItem; score: number }[] = [];
        for (const item of filtered) {
            const score = scoreAssetMatch(item.symbol, item.name, search);
            if (score > 0) {
                scoredItems.push({ item, score });
            }
        }

        // Aramada önce eşleşme puanına, eşitlikte seçili sıralamaya bakılır
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
        screener: filtered.slice(0, 100),
        totalCount: filtered.length,
    });
}
