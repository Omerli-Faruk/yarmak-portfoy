'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, History, Activity, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Brush } from 'recharts';
import Link from "next/link";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import TransactionDatePicker from "@/components/TransactionDatePicker";
import { InteractiveAreaChart, ChartPeriod } from "@/components/InteractiveAreaChart";
import { formatMoney, formatDate } from '@/lib/formatters';

// Ortak formatlama fonksiyonları lib/formatters.ts'den import ediliyor

export interface AssetTransaction {
    ID?: number;
    id?: number;
    Type?: string;
    type?: string;
    Amount?: string;
    amount?: string;
    Price?: string;
    price?: string;
    Commission?: string;
    commission?: string;
    TransactionDate?: string;
    transaction_date?: string;
    Symbol?: string;
    symbol?: string;
    RealizedPnl?: string;
    realized_pnl?: string;
}

export interface AssetDetailInfo {
    id?: number;
    ID?: number;
    symbol?: string;
    Symbol?: string;
    name?: string;
    Name?: string;
    asset_type?: string;
    AssetType?: string;
    current_price?: string;
    CurrentPrice?: string;
    change?: string;
    positive?: boolean;
}

export interface AssetFundamentals {
    marketCap?: string;
    peRatio?: string;
    dividendYield?: string;
    dividendRate?: string;
    exDividendDate?: string;
    beta?: string;
    fiftyTwoWeekHigh?: string;
    fiftyTwoWeekLow?: string;
    volume?: string;
    isStale?: boolean;
    staleMessage?: string;
    lastUpdateDate?: string;
}

export interface AssetChartItem {
    date: string;
    price: number;
}

function calculateHolding(txs: AssetTransaction[]) {
    let totalLots = 0;
    let totalCost = 0;
    
    // Sort chronologically (oldest first)
    const sorted = [...txs].sort((a, b) => new Date(a.TransactionDate || a.transaction_date || '').getTime() - new Date(b.TransactionDate || b.transaction_date || '').getTime());
    
    for (const tx of sorted) {
        const type = tx.Type || tx.type;
        const amt = parseFloat(tx.Amount || tx.amount || '0');
        const price = parseFloat(tx.Price || tx.price || '0');
        const comm = parseFloat(tx.Commission || tx.commission || '0');
        
        if (type === 'BUY') {
            totalCost += (amt * price) + comm;
            totalLots += amt;
        } else if (type === 'SELL') {
            if (totalLots > 0) {
                const avgCostPerShare = totalCost / totalLots;
                totalCost -= (avgCostPerShare * amt);
                totalLots -= amt;
            }
        }
    }
    
    if (totalLots <= 0) {
        totalLots = 0;
        totalCost = 0;
    }
    
    const avgCost = totalLots > 0 ? (totalCost / totalLots) : 0;
    return { totalLots, avgCost, totalCost };
}

export default function AssetDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    
    const rawSymbol = (params.symbol as string).toUpperCase();

    const [transactions, setTransactions] = useState<AssetTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [assetData, setAssetData] = useState<AssetDetailInfo | null>(null);
    const [chartData, setChartData] = useState<AssetChartItem[]>([]);
    const [fundamentals, setFundamentals] = useState<AssetFundamentals | null>(null);
    const [summaryData, setSummaryData] = useState<Record<string, number> | null>(null);
    const [timeRange, setTimeRange] = useState('1M'); // 1W, 1M, 3M, 6M, 1Y, ALL
    const [isChartLoading, setIsChartLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [txType, setTxType] = useState('BUY');
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState('');
    const [txDate, setTxDate] = useState(new Date().toISOString());
    const [txCommission, setTxCommission] = useState('0');
    const [isTxDateError, setIsTxDateError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Return state
    const [periodReturn, setPeriodReturn] = useState<number | null>(null);

    const isLoggedIn = !!(user || (typeof window !== 'undefined' && localStorage.getItem('is_logged_in') === 'true'));

    const loadAssetAndTransactions = async () => {
        try {
            setLoading(true);
            // 1. Fetch live asset info
            const assetRes = await fetch(`/api/assets?q=${rawSymbol}`);
            if (assetRes.ok) {
                const results = await assetRes.json();
                const matched = results.find((r: any) => r.symbol === rawSymbol);
                if (matched) setAssetData(matched);
            }

            // 2. Fetch User Transactions

            if (isLoggedIn) {
                try {
                    const txRes = await api.get('/transactions?limit=1000');
                    if (txRes.data) {
                        const filtered = txRes.data.filter((t: any) => (t.Symbol || t.symbol) === rawSymbol);
                        setTransactions(filtered);
                    }
                } catch (txErr) {
                    console.log('Misafir veya token geçersiz');
                }
            }
        } catch (error) {
            console.error('Error fetching asset or transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const [pollCount, setPollCount] = useState(0);

    const chartCacheRef = useRef<Record<string, { chart: any[]; timestamp: number }>>({});

    const loadChartAndFundamentals = async () => {
        // Önceden çekilmişse ve 45 saniyeden eskiyse anında bellekten göster (0 ms gecikme, sıfır API yükü)
        const cached = chartCacheRef.current[timeRange];
        if (cached && cached.chart && cached.chart.length > 0) {
            setChartData(cached.chart);
            setIsChartLoading(false);
            const firstPrice = Number(cached.chart[0]?.price || 0);
            const lastPrice = Number(cached.chart[cached.chart.length - 1]?.price || 0);
            if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
            }
            if (Date.now() - cached.timestamp < 45000) {
                return;
            }
        } else {
            setIsChartLoading(true);
        }

        try {
            const url = `/api/assets/detail?symbol=${rawSymbol}&range=${timeRange}`;
            const detailRes = await fetch(url);
            if (detailRes.ok) {
                const det = await detailRes.json();
                if (det.chart && det.chart.length > 0) {
                    setChartData(det.chart);
                    chartCacheRef.current[timeRange] = { chart: det.chart, timestamp: Date.now() };
                    setPollCount(0); // Reset polling
                    
                    // Calculate period return
                    const firstPrice = Number(det.chart[0]?.price || 0);
                    const lastPrice = Number(det.chart[det.chart.length - 1]?.price || 0);
                    if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                        setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
                    } else {
                        setPeriodReturn(null);
                    }
                } else if (!cached) {
                    setChartData([]);
                    setPeriodReturn(null);
                    
                    // If no data, the backend backfill queue was triggered. Poll every 3 seconds!
                    if (pollCount < 15) {
                        setTimeout(() => setPollCount(prev => prev + 1), 3000);
                    }
                }
                if (det.asset) {
                    setAssetData(prev => ({
                        ...(prev || {}),
                        ...det.asset,
                        current_price: det.asset.current_price || prev?.current_price,
                        change: det.asset.change || prev?.change,
                        positive: det.asset.positive !== undefined ? det.asset.positive : prev?.positive,
                    }));
                    setLoading(false);
                }
                if (det.chart && det.chart.length > 0) {
                    const lastPt = det.chart[det.chart.length - 1];
                    if (lastPt && lastPt.price > 0) {
                        const formattedPrice = lastPt.price >= 100 ? lastPt.price.toFixed(2) : (lastPt.price >= 1 ? lastPt.price.toFixed(2) : lastPt.price.toFixed(4));
                        setAssetData(prev => prev ? { ...prev, current_price: formattedPrice } : prev);
                    }
                }
                if (det.fundamentals) setFundamentals(det.fundamentals);
                if (det.summary) setSummaryData(det.summary);
            }
        } catch (error) {
            console.error('Error fetching chart/fundamentals:', error);
        } finally {
            setIsChartLoading(false);
        }
    };

    const handleBrushChange = (e: { startIndex?: number; endIndex?: number }) => {
        if (!chartData || chartData.length === 0) return;
        if (e.startIndex !== undefined && e.endIndex !== undefined) {
            const firstPrice = Number(chartData[e.startIndex]?.price || 0);
            const lastPrice = Number(chartData[e.endIndex]?.price || 0);
            if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
            }
        }
    };

    useEffect(() => {
        loadAssetAndTransactions();
    }, [rawSymbol]);

    useEffect(() => {
        loadChartAndFundamentals();
    }, [rawSymbol, timeRange, pollCount]);

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (new Date(txDate).getTime() > Date.now() + 60000) {
            alert('Gelecek tarihli işlem kaydedilemez.');
            return;
        }
        try {
            setSubmitting(true);
            const payload = {
                symbol: rawSymbol,
                asset_type: assetData?.asset_type || 'HISSE',
                type: txType,
                amount: txAmount,
                price: txPrice,
                commission: txCommission,
                transaction_date: new Date(txDate).toISOString(),
            };
            
            await api.post('/transactions', payload);
            setIsModalOpen(false);
            setTxAmount('');
            setTxPrice('');
            setTxCommission('0');
            await loadAssetAndTransactions();
        } catch (error: any) {
            alert(error.response?.data?.error || 'İşlem eklenirken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            await loadAssetAndTransactions();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Silinirken hata oluştu');
        }
    };

    const { totalLots, avgCost, totalCost } = calculateHolding(transactions);
    const currentPrice = assetData?.current_price ? parseFloat(assetData.current_price) : 0;
    const currentTotalValue = totalLots * currentPrice;
    const profitLoss = currentTotalValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
    const isProfit = profitLoss >= 0;

    const assetPeriods: ChartPeriod[] = useMemo(() => {
        const list: { id: string; label: string; rKey: string }[] = [];
        if (assetData && assetData.asset_type !== 'FON') {
            list.push({ id: '1D', label: '1G', rKey: '1D' });
        }
        list.push(
            { id: '1W', label: '1H', rKey: '1W' },
            { id: '1M', label: '1A', rKey: '1M' },
            { id: '3M', label: '3A', rKey: '3M' },
            { id: '6M', label: '6A', rKey: '6M' },
            { id: 'YTD', label: 'YBB', rKey: 'YTD' },
            { id: '1Y', label: '1Y', rKey: '1Y' },
            { id: '3Y', label: '3Y', rKey: '3Y' },
            { id: '5Y', label: '5Y', rKey: '5Y' },
        );

        return list.map(item => {
            let sumVal: number | null = null;
            if (item.id === '1D') {
                if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D']) && summaryData['1D'] !== 0) {
                    sumVal = summaryData['1D'];
                } else if (assetData?.change !== undefined && assetData.change !== '' && assetData.change !== '0.00' && assetData.change !== '0') {
                    const parsed = parseFloat(String(assetData.change).replace('+', ''));
                    if (!isNaN(parsed)) sumVal = parsed;
                } else if (periodReturn !== null && !isNaN(periodReturn)) {
                    sumVal = periodReturn;
                }
            } else if (item.id === 'CUSTOM') {
                if (timeRange === 'CUSTOM' && periodReturn !== null) {
                    sumVal = periodReturn;
                }
            } else if (summaryData) {
                if (summaryData[item.rKey] !== undefined) {
                    sumVal = summaryData[item.rKey];
                } else if (summaryData[item.id] !== undefined) {
                    sumVal = summaryData[item.id];
                } else if (item.id === '5Y' && summaryData['ALL'] !== undefined) {
                    sumVal = summaryData['ALL'];
                }
            }

            if (sumVal === null && timeRange === item.id && periodReturn !== null) {
                sumVal = periodReturn;
            }

            return {
                id: item.id,
                label: item.label,
                changePercent: sumVal,
            };
        });
    }, [assetData, summaryData, periodReturn, timeRange]);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!assetData) {
        return (
            <div className="min-h-screen  flex flex-col items-center justify-center text-white px-4">
                <Activity className="w-16 h-16 mb-4 text-slate-600" />
                <h1 className="text-3xl font-bold mb-2">Varlık Bulunamadı</h1>
                <p className="text-slate-400 mb-6 text-center max-w-md">Aradığınız varlık ({rawSymbol}) sistemimizde bulunmuyor veya geçici olarak ulaşılamıyor.</p>
                <button onClick={() => router.push('/')} className="bg-[#1A9FD3] hover:bg-[#1589B7] px-6 py-2 rounded-lg font-medium transition cursor-pointer">Ana Sayfaya Dön</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>


                    {isLoggedIn ? (
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center transition cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
                        >
                            <Plus className="w-4 h-4 mr-1 stroke-[2.5]" />
                            İşlem Ekle
                        </button>
                    ) : (
                        <button 
                            onClick={() => router.push('/register')}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center transition cursor-pointer"
                        >
                            Hesap Oluştur
                        </button>
                    )}
                </div>

                {/* Asset Info Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-3">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                                    {assetData?.symbol || rawSymbol}
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider border border-slate-700/80">
                                        {assetData?.asset_type}
                                    </span>
                                </h1>
                                <p className="text-slate-400 mt-1 md:text-lg">{assetData?.name || 'Yükleniyor...'}</p>
                                
                                {/* Son Güncelleme: Doğrudan hisse adı ve sembolün altında */}
                                {fundamentals?.staleMessage && (
                                    <div className="mt-2.5 flex items-center">
                                        <button 
                                            onClick={() => {
                                                chartCacheRef.current = {};
                                                loadChartAndFundamentals();
                                            }}
                                            title="Verileri yenilemek için tıklayın"
                                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium border transition hover:opacity-80 active:scale-95 cursor-pointer ${
                                                fundamentals.isStale 
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                            }`}
                                        >
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{fundamentals.staleMessage}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {assetData && (
                        <div className="md:text-right flex flex-col md:items-end">
                            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
                                {assetData.current_price} ₺
                            </p>
                            
                            {(() => {
                                let dailyChangeVal: number | null = null;
                                if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D']) && summaryData['1D'] !== 0) {
                                    dailyChangeVal = summaryData['1D'];
                                } else if (assetData?.change !== undefined && assetData.change !== '' && assetData.change !== '0.00' && assetData.change !== '0') {
                                    const parsed = parseFloat(String(assetData.change).replace('+', ''));
                                    if (!isNaN(parsed)) dailyChangeVal = parsed;
                                } else if (periodReturn !== null && !isNaN(periodReturn)) {
                                    dailyChangeVal = periodReturn;
                                } else if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D'])) {
                                    dailyChangeVal = summaryData['1D'];
                                } else if (assetData?.change !== undefined) {
                                    const parsed = parseFloat(String(assetData.change).replace('+', ''));
                                    if (!isNaN(parsed)) dailyChangeVal = parsed;
                                }

                                if (dailyChangeVal === null) return null;

                                const isPos = dailyChangeVal >= 0;
                                const formatted = `${dailyChangeVal > 0 ? '+' : ''}${dailyChangeVal.toFixed(2)}%`;

                                return (
                                    <p className={`flex items-center md:justify-end text-lg mt-1 font-medium ${isPos ? 'text-emerald-400' : 'text-rose-400'}`} title="Bugünün Değişimi">
                                        {isPos ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                                        {formatted}
                                        <span className="text-xs text-slate-400 ml-2 font-normal">(Günlük)</span>
                                    </p>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Main Content Flex Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Left Col: Chart & Stats (Wider) */}
                    <div className="flex-1 flex flex-col gap-6">
                        
                        {/* CHART */}
                        <InteractiveAreaChart
                            title="Fiyat Grafiği"
                            subtitle={assetData ? `${assetData.symbol} detaylı zaman ve fiyat analizi` : undefined}
                            data={chartData.map(pt => ({
                                date: pt.date,
                                value: typeof pt.price === 'number' ? pt.price : parseFloat(String(pt.price || 0)),
                                raw: typeof pt.price === 'number' ? pt.price : parseFloat(String(pt.price || 0)),
                            }))}
                            dataKey="value"
                            dateKey="date"
                            periods={assetPeriods}
                            activePeriod={timeRange}
                            onPeriodChange={(r) => setTimeRange(r)}
                            currencySymbol="₺"
                            currency="TRY"
                            valueFormatter={(val) => {
                                const decimals = val < 1 ? (val < 0.01 ? 6 : 4) : 2;
                                return `${val.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ₺`;
                            }}
                            showBrush={true}
                            showStats={true}
                            isLoading={isChartLoading}
                            emptyMessage={
                                assetData?.asset_type === 'FON'
                                    ? "Fon fiyat verileri hazırlanıyor, lütfen birkaç saniye bekleyin..."
                                    : "Grafik verisi yükleniyor veya veri bulunamadı..."
                            }
                        />

                        {/* PORTFOLIO SNAPSHOT (If holding) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shrink-0">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                                Pozisyonum & Kâr / Zarar
                            </h3>
                            {totalLots > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-slate-400 text-xs mb-1">Mevcut Lot</p>
                                        <p className="text-lg font-bold text-white">{totalLots.toLocaleString('tr-TR')}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs mb-1">Maliyet (AOF)</p>
                                        <p className="text-lg font-bold text-white">{avgCost.toFixed(3)} ₺</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs mb-1">Toplam Değer</p>
                                        <p className="text-lg font-bold text-white">{formatMoney(currentTotalValue)}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs mb-1">Anlık Kâr / Zarar</p>
                                        <p className={`text-lg font-bold flex items-center ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                             {isProfit ? '+' : ''}{formatMoney(profitLoss)}
                                            <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-black/20">
                                                {isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between py-1 text-slate-500 text-sm">
                                    <span>Bu varlıktan portföyünüzde henüz lot bulunmuyor.</span>
                                    {(isLoggedIn) && (
                                        <button 
                                            onClick={() => setIsModalOpen(true)}
                                            className="text-xs font-semibold text-[#1A9FD3] hover:text-[#1589B7] transition underline cursor-pointer"
                                        >
                                            İşlem Ekle
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Col: Transaction History (Narrower) */}
                    <div className="w-full lg:w-96 xl:w-1/3 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[32rem] lg:h-auto">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4 shrink-0">
                            <div className="flex items-center text-lg font-semibold text-white">
                                <History className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                                İşlem Geçmişi
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            {!(isLoggedIn) ? (
                                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                                    <History className="w-12 h-12 mb-3 opacity-20" />
                                    <p>İşlem geçmişinizi görmek için ücretsiz hesap açın.</p>
                                    <button onClick={() => router.push('/register')} className="text-[#1A9FD3] hover:text-[#1589B7] hover:underline mt-3 text-sm transition font-medium cursor-pointer">Hesap Oluştur</button>
                                </div>
                            ) : loading ? (
                                <p className="text-center text-slate-500 py-8">Yükleniyor...</p>
                            ) : transactions.length === 0 ? (
                                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                                    <p>Henüz işlem geçmişi yok.</p>
                                    <button onClick={() => setIsModalOpen(true)} className="text-[#1A9FD3] hover:text-[#1589B7] hover:underline mt-3 text-sm transition cursor-pointer">İlk işlemini ekle</button>
                                </div>
                            ) : (
                                transactions.map((tx) => {
                                    const txType = tx.Type || tx.type || 'BUY';
                                    const txAmount = tx.Amount || tx.amount || '0';
                                    const txPrice = tx.Price || tx.price || '0';
                                    const txCommission = tx.Commission || tx.commission || '0';
                                    const txDate = tx.TransactionDate || tx.transaction_date || '';
                                    const txRealizedPnl = tx.RealizedPnl || tx.realized_pnl || '0';
                                    const parsedComm = parseFloat(txCommission) || 0;
                                    const subtotal = (parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0);
                                    const totalWithComm = txType === 'BUY' ? subtotal + parsedComm : subtotal - parsedComm;
                                    
                                    return (
                                        <div key={tx.ID || tx.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${txType === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {txType === 'BUY' ? 'ALIM' : 'SATIM'}
                                                    </span>
                                                    <span className="text-slate-400 text-xs ml-3">{formatDate(txDate)}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelete(tx.ID || tx.id || 0)}
                                                    className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 p-1 rounded"
                                                    title="Sil"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5">Fiyat</p>
                                                    <p className="font-medium text-slate-200">{parseFloat(txPrice).toFixed(4)} ₺</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5">Adet / Lot</p>
                                                    <p className="font-medium text-slate-200">{parseFloat(txAmount).toLocaleString('tr-TR')}</p>
                                                </div>
                                            </div>

                                            {parsedComm > 0 && (
                                                <div className="mt-2 pt-2 border-t border-slate-700/40 flex justify-between items-center text-xs">
                                                    <span className="text-amber-400/90 flex items-center gap-1">
                                                        <span>Komisyon:</span>
                                                        <span className="font-medium font-mono">+{parsedComm.toFixed(2)} ₺</span>
                                                    </span>
                                                    <span className="text-slate-400">
                                                        Toplam: <span className="font-medium text-slate-200 font-mono">{totalWithComm.toFixed(2)} ₺</span>
                                                    </span>
                                                </div>
                                            )}

                                            {txType === 'SELL' && parseFloat(txRealizedPnl) !== 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                                                    <p className="text-xs text-slate-400">Gerçekleşen Kâr/Zarar</p>
                                                    <p className={`font-semibold text-sm ${parseFloat(txRealizedPnl) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {parseFloat(txRealizedPnl) > 0 ? '+' : ''}{parseFloat(txRealizedPnl).toFixed(2)} ₺
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* DIV 9: Bottom Row: Temel Bilgiler (Hisseler için gösterilir) */}
                {fundamentals && assetData?.asset_type === 'HISSE' && (
                    <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                            Temel Bilgiler & İstatistikler
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4">
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Piyasa Değeri</p>
                                <p className="font-semibold text-slate-200">{fundamentals.marketCap}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">F/K Oranı</p>
                                <p className="font-semibold text-slate-200">{fundamentals.peRatio}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Temettü Verimi</p>
                                <p className="font-semibold text-slate-200">{fundamentals.dividendYield}</p>
                            </div>
                            {fundamentals.dividendRate !== '-' && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Hisse Başı Temettü</p>
                                    <p className="font-semibold text-slate-200">{fundamentals.dividendRate}</p>
                                </div>
                            )}
                            {fundamentals.exDividendDate !== '-' && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Son Temettü Tarihi</p>
                                    <p className="font-semibold text-slate-200">{fundamentals.exDividendDate}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Beta (Risk)</p>
                                <p className="font-semibold text-slate-200">{fundamentals.beta}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">52 Hafta Zirve</p>
                                <p className="font-semibold text-slate-200">{fundamentals.fiftyTwoWeekHigh}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">52 Hafta Dip</p>
                                <p className="font-semibold text-slate-200">{fundamentals.fiftyTwoWeekLow}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Hacim</p>
                                <p className="font-semibold text-slate-200">{fundamentals.volume}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* TRANSACTION MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto">
                        <div className="flex justify-between items-center p-5 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <Activity className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                                İşlem Ekle ({rawSymbol})
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddTransaction} className="p-6 space-y-5">
                            
                            {/* Type Tabs */}
                            <div className="flex p-1 bg-slate-800 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setTxType('BUY')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${txType === 'BUY' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    ALIM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTxType('SELL')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${txType === 'SELL' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    SATIM
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Adet (Lot)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        min="0.000001"
                                        required
                                        value={txAmount}
                                        onChange={e => setTxAmount(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#1A9FD3] focus:ring-1 focus:ring-[#1A9FD3]"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Birim Fiyat (₺)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        min="0.000001"
                                        required
                                        value={txPrice}
                                        onChange={e => setTxPrice(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#1A9FD3] focus:ring-1 focus:ring-[#1A9FD3]"
                                        placeholder={assetData?.current_price ? assetData.current_price.toString() : "0.00"}
                                    />
                                </div>
                            </div>

                            {/* 🗓️ GELİŞMİŞ ERGONOMİK TARİH VE SAAT SEÇİCİ */}
                            <TransactionDatePicker value={txDate} onChange={setTxDate} onErrorChange={setIsTxDateError} />

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Ödenen Komisyon (₺) - Opsiyonel</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    value={txCommission}
                                    onChange={e => setTxCommission(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#1A9FD3] focus:ring-1 focus:ring-[#1A9FD3]"
                                    placeholder="0.00"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">Komisyon girilirse alış maliyetine eklenir, kâr/zarar hesabını etkiler.</p>
                            </div>

                            {/* Toplam İşlem Tutarı Özeti */}
                            {parseFloat(txAmount) > 0 && parseFloat(txPrice) > 0 && (
                                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1 text-xs">
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span>İşlem Tutarı:</span>
                                        <span className="font-mono text-slate-200 font-medium">
                                            {((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                        </span>
                                    </div>
                                    {parseFloat(txCommission) > 0 && (
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span>+ Komisyon:</span>
                                            <span className="font-mono font-medium text-slate-200">
                                                {parseFloat(txCommission).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                            </span>
                                        </div>
                                    )}
                                    <div className="pt-1.5 border-t border-slate-700 flex justify-between items-center">
                                        <span className="text-slate-300 font-medium">Toplam {txType === 'BUY' ? 'Maliyet' : 'Net Tutar'}:</span>
                                        <span className="font-bold text-white font-mono text-sm">
                                            {(((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)) + (txType === 'BUY' ? (parseFloat(txCommission) || 0) : -(parseFloat(txCommission) || 0))).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={submitting || isTxDateError}
                                className="w-full bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
                            >
                                {submitting ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Custom Scrollbar CSS */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(30, 41, 59, 0.5); 
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(71, 85, 105, 0.8); 
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(26, 159, 211, 0.8); 
                }
            `}</style>
        </div>
    );
}
