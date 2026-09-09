import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// In-memory cache for TEFAS requests (1 hour TTL)
interface TefasCacheItem {
    chart: { date: string; price: number }[];
    fundamentals: any;
    expiresAt: number;
}
const tefasMemoryCache = new Map<string, TefasCacheItem>();

function formatTefasDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

async function fetchTefasChunk(symbol: string, startStr: string, endStr: string) {
    for (const fonTipi of ['YAT', 'EMK']) {
        try {
            const res = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://www.tefas.gov.tr',
                    'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    fonTipi,
                    fonKodu: symbol.toUpperCase(),
                    basTarih: startStr,
                    bitTarih: endStr,
                    basSira: 1,
                    bitSira: 1000,
                    dil: 'TR'
                }),
                next: { revalidate: 3600 }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.resultList && data.resultList.length > 0) {
                    return data.resultList;
                }
            }
        } catch (e) {
            console.error(`TEFAS chunk fetch error (${fonTipi}):`, e);
        }
    }
    return [];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol');
    const range = searchParams.get('range') || '1M'; // 1W, 1M, 3M, 6M, 1Y, ALL

    if (!rawSymbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        let chartData: { date: string; price: number | null }[] = [];
        let fundamentals = null;
        let isTefas = false;
        
        // TEFAS check
        if (rawSymbol.length === 3 && rawSymbol !== 'USD' && rawSymbol !== 'EUR') {
            isTefas = true;
        }

        if (isTefas) {
            const cacheKey = `${rawSymbol}_${range}`;
            const cached = tefasMemoryCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return NextResponse.json({ chart: cached.chart, fundamentals: cached.fundamentals });
            }

            const today = new Date();
            const start = new Date();
            
            // TEFAS API restricts a single request to <= 1 month ("Tarih aralığı 1 ayı aşamaz")
            if (range === '1W') start.setDate(today.getDate() - 7);
            else start.setDate(today.getDate() - 30); // 1M or initial chunk for 3M/6M/1Y/ALL

            try {
                const resultList = await fetchTefasChunk(rawSymbol, formatTefasDate(start), formatTefasDate(today));
                
                if (resultList && resultList.length > 0) {
                    const sorted = [...resultList].sort((a: any, b: any) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
                    chartData = sorted.map((item: any) => ({
                        date: new Date(item.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                        price: item.fiyat
                    }));
                    
                    const latest = resultList[0];
                    fundamentals = {
                        marketCap: latest.portfoyBuyukluk ? new Intl.NumberFormat('tr-TR', { notation: "compact", compactDisplay: "short" }).format(latest.portfoyBuyukluk) + ' ₺' : 'TEFAS Fonu',
                        peRatio: '-',
                        dividendYield: '-',
                        beta: '-',
                        fiftyTwoWeekHigh: '-',
                        fiftyTwoWeekLow: '-',
                        volume: latest.tedPaySayisi ? new Intl.NumberFormat('tr-TR', { notation: "compact" }).format(latest.tedPaySayisi) : '-',
                        investorCount: latest.kisiSayisi ? new Intl.NumberFormat('tr-TR').format(latest.kisiSayisi) : '-',
                    };

                    tefasMemoryCache.set(cacheKey, {
                        chart: chartData as { date: string; price: number }[],
                        fundamentals,
                        expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour cache
                    });
                }
            } catch (err) {
                console.error("TEFAS Error:", err);
            }
        } else {
            // BIST / Currencies
            let yfSymbol = `${rawSymbol}.IS`;
            if (rawSymbol === 'USDTRY' || rawSymbol === 'EURTRY') yfSymbol = `${rawSymbol}=X`;
            if (rawSymbol === 'ALTIN' || rawSymbol === 'XAUUSD') yfSymbol = 'GC=F';

            // Calculate Period
            const today = new Date();
            let startDate = new Date();
            let interval: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h" | "1d" | "5d" | "1wk" | "1mo" | "3mo" = "1d";
            
            if (range === '1D') { startDate.setDate(today.getDate() - 4); interval = "5m"; } // Fetch 4 days back to handle weekends
            else if (range === '1W') { startDate.setDate(today.getDate() - 7); interval = "30m"; }
            else if (range === '1M') { startDate.setMonth(today.getMonth() - 1); interval = "60m"; }
            else if (range === '3M') { startDate.setMonth(today.getMonth() - 3); interval = "60m"; }
            else if (range === '6M') { startDate.setMonth(today.getMonth() - 6); interval = "1d"; }
            else if (range === '1Y') { startDate.setFullYear(today.getFullYear() - 1); interval = "1wk"; }
            else if (range === 'ALL') { startDate = new Date('2015-01-01'); interval = "1mo"; } // True ALL (from inception)

            try {
                const queryOptions = { period1: startDate.toISOString().split('T')[0], interval };
                const chartRes = await yahooFinance.chart(yfSymbol, queryOptions);
                
                if (chartRes && chartRes.quotes) {
                    let quotes = chartRes.quotes;
                    
                    // For 1D, filter only the last actual trading day
                    if (range === '1D' && quotes.length > 0) {
                        const lastDateObj = new Date(quotes[quotes.length - 1].date);
                        const lastDayStr = lastDateObj.toLocaleDateString('tr-TR');
                        quotes = quotes.filter((q: any) => new Date(q.date).toLocaleDateString('tr-TR') === lastDayStr);
                    }

                    chartData = quotes.map((q: any) => {
                        const d = new Date(q.date);
                        let dateStr = '';
                        if (range === '1D') {
                            dateStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        } else if (range === '1W' || range === '1M' || range === '3M') {
                            dateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        } else if (range === 'ALL') {
                            dateStr = d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
                        } else {
                            dateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                        }
                        return {
                            date: dateStr,
                            price: q.close || null,
                        };
                    }).filter((d: any) => d.price !== null);
                }
                
                // Quote Summary
                const quoteRes = await yahooFinance.quoteSummary(yfSymbol, { modules: ['summaryDetail', 'price', 'defaultKeyStatistics'] });
                if (quoteRes) {
                    fundamentals = {
                        marketCap: quoteRes.price?.marketCap ? new Intl.NumberFormat('tr-TR', { notation: "compact", compactDisplay: "short" }).format(quoteRes.price.marketCap) + ' ₺' : '-',
                        peRatio: quoteRes.summaryDetail?.trailingPE?.toFixed(2) || '-',
                        dividendYield: quoteRes.summaryDetail?.dividendYield ? (quoteRes.summaryDetail.dividendYield * 100).toFixed(2) + '%' : '-',
                        dividendRate: quoteRes.summaryDetail?.dividendRate ? quoteRes.summaryDetail.dividendRate + ' ₺' : '-',
                        exDividendDate: quoteRes.summaryDetail?.exDividendDate ? new Date(quoteRes.summaryDetail.exDividendDate).toLocaleDateString('tr-TR') : '-',
                        beta: quoteRes.summaryDetail?.beta?.toFixed(2) || '-',
                        fiftyTwoWeekHigh: quoteRes.summaryDetail?.fiftyTwoWeekHigh?.toFixed(2) || '-',
                        fiftyTwoWeekLow: quoteRes.summaryDetail?.fiftyTwoWeekLow?.toFixed(2) || '-',
                        volume: quoteRes.summaryDetail?.volume ? new Intl.NumberFormat('tr-TR', { notation: "compact" }).format(quoteRes.summaryDetail.volume) : '-',
                    };
                }
            } catch (err) {
                console.error("Yahoo Error:", err);
            }
        }

        return NextResponse.json({ chart: chartData, fundamentals });
    } catch (error) {
        return NextResponse.json({ chart: [], fundamentals: null });
    }
}
