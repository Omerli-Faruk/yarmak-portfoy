import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080/v1';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol');
    let range = searchParams.get('range') || '1Y';

    if (!rawSymbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Convert CUSTOM back to ALL for the backend
    let backendRange = range;
    // We let backendRange = 'CUSTOM' pass through so the backend returns daily data

    try {
        // Step 1: Find the Asset ID from backend
        const assetsRes = await fetch(`${BACKEND_URL}/assets`, { next: { revalidate: 300 } });
        if (!assetsRes.ok) throw new Error("Failed to fetch assets");
        const allAssets = await assetsRes.json();
        const asset = allAssets.find((a: any) => (a.Symbol || a.symbol) === rawSymbol);
        
        if (!asset) {
            return NextResponse.json({ chart: [], fundamentals: null });
        }
        
        const assetId = asset.ID || asset.id;
        const isTefas = (asset.AssetType || asset.asset_type) === 'FON';

        // Step 2: Fetch Chart Data from Backend (Backend handles 1Y weekly and ALL monthly grouping)
        const historyRes = await fetch(`${BACKEND_URL}/assets/${assetId}/price-history?range=${backendRange}`, { next: { revalidate: 0 } });
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

                // Filter history by range!
                const now = new Date();
                let cutoffDate = new Date(0); // ALL
                
                if (range === '1D') {
                    cutoffDate = new Date(now);
                    cutoffDate.setDate(now.getDate() - 1); // Not exact for weekends, but ok
                } else if (range === '1W') {
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
                                // 1h interval: always ends in :30. Round all down to :00 (09:30 -> 09:00, 10:30 -> 10:00)
                                if (adjustedD.getMinutes() === 30) {
                                    adjustedD.setMinutes(0);
                                }
                            } else if (range === '1W' || range === '1D') {
                                // 30m or 5m interval: only round the opening 09:30 to 09:00, keep others intact (10:30 -> 10:30)
                                if (adjustedD.getHours() === 9 && adjustedD.getMinutes() === 30) {
                                    adjustedD.setMinutes(0);
                                }
                            }
                            dateStr += ' ' + adjustedD.toLocaleTimeString('tr-TR', { ...tzOptions, hour12: false, hour: '2-digit', minute: '2-digit' });
                        }
                    } else if (range === 'ALL' || range === '5Y' || range === '3Y' || range === '1Y') {
                        dateStr = d.toLocaleDateString('tr-TR', { ...tzOptions, month: 'short', year: 'numeric' });
                    } else if (range === 'CUSTOM') {
                        if (history.length <= 40) { // Kısa aralıksa sadece gün ve ay göster
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

        // Step 3: Check if we need to trigger backfill
        // If data is very sparse or missing, ask backend to put it in the queue
        if (chartData.length < 3 && range !== '1D') {
            fetch(`${BACKEND_URL}/assets/${assetId}/backfill`, { method: 'POST' }).catch(console.error);
        }

        // Step 4: Fundamentals / UI Hints
        let fundamentals: any = null;
        if (isTefas) {
            let isStale = false;
            let staleMessage = "";
            
            if (chartData.length > 0) {
                const latestRecordTime = chartData[chartData.length - 1].rawDate;
                const today = new Date();
                
                // If the latest record is older than yesterday, or it's evening but we only have yesterday's price
                if (latestRecordTime) {
                    const daysDiff = (today.getTime() - latestRecordTime.getTime()) / (1000 * 3600 * 24);
                    if (daysDiff >= 3) {
                        isStale = true;
                        staleMessage = `Son Güncelleme: ${latestRecordTime.toLocaleDateString('tr-TR')}`;
                    }
                }
            }

            fundamentals = {
                marketCap: '-',
                peRatio: '-',
                dividendYield: '-',
                dividendRate: '-',
                exDividendDate: '-',
                beta: '-',
                fiftyTwoWeekHigh: '-',
                fiftyTwoWeekLow: '-',
                volume: '-',
                isStale,
                staleMessage
            };
        }

        // Clean rawDate before sending to client
        const cleanChartData = chartData.map(d => ({ date: d.date, price: d.price }));

        return NextResponse.json({ chart: cleanChartData, fundamentals });
    } catch (error) {
        console.error("Route error:", error);
        return NextResponse.json({ chart: [], fundamentals: null });
    }
}
