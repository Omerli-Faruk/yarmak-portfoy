'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, History, Activity, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Brush } from 'recharts';
import Link from "next/link";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// FORMATTERS
function formatMoney(amount: number) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
}

function formatDate(dateStr: string) {
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateStr));
}

function calculateHolding(txs: any[]) {
    let totalLots = 0;
    let totalCost = 0;
    
    // Sort chronologically (oldest first)
    const sorted = [...txs].sort((a, b) => new Date(a.TransactionDate || a.transaction_date).getTime() - new Date(b.TransactionDate || b.transaction_date).getTime());
    
    for (const tx of sorted) {
        const type = tx.Type || tx.type;
        const amt = parseFloat(tx.Amount || tx.amount);
        const price = parseFloat(tx.Price || tx.price);
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

    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [assetData, setAssetData] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [fundamentals, setFundamentals] = useState<any>(null);
    const [timeRange, setTimeRange] = useState('1M'); // 1W, 1M, 3M, 6M, 1Y, ALL
    const [isChartLoading, setIsChartLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [txType, setTxType] = useState('BUY');
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState('');
    const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 16));
    const [txCommission, setTxCommission] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    // Custom Date Range & Return states
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [periodReturn, setPeriodReturn] = useState<number | null>(null);

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
            const isLoggedIn = user || (typeof window !== 'undefined' && localStorage.getItem('is_logged_in') === 'true');
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

    const loadChartAndFundamentals = async () => {
        setIsChartLoading(true);
        try {
            // If CUSTOM is selected, we fetch CUSTOM data (daily from backend) so the brush can zoom freely!
            const fetchRange = timeRange;
            const url = `/api/assets/detail?symbol=${rawSymbol}&range=${fetchRange}`;
            const detailRes = await fetch(url);
            if (detailRes.ok) {
                const det = await detailRes.json();
                if (det.chart && det.chart.length > 0) {
                    setChartData(det.chart);
                    setPollCount(0); // Reset polling
                    
                    // Calculate period return
                    const firstPrice = parseFloat(det.chart[0].price);
                    const lastPrice = parseFloat(det.chart[det.chart.length - 1].price);
                    if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                        setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
                    } else {
                        setPeriodReturn(null);
                    }
                } else {
                    setChartData([]);
                    setPeriodReturn(null);
                    
                    // If no data, the backend backfill queue was triggered. Poll every 3 seconds!
                    if (pollCount < 15) {
                        setTimeout(() => setPollCount(prev => prev + 1), 3000);
                    }
                }
                if (det.fundamentals) setFundamentals(det.fundamentals);
            }
        } catch (error) {
            console.error('Error fetching chart/fundamentals:', error);
        } finally {
            setIsChartLoading(false);
        }
    };

    const handleBrushChange = (e: any) => {
        if (!chartData || chartData.length === 0) return;
        if (e.startIndex !== undefined && e.endIndex !== undefined) {
            const firstPrice = parseFloat(chartData[e.startIndex].price);
            const lastPrice = parseFloat(chartData[e.endIndex].price);
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
    const currentPrice = assetData ? parseFloat(assetData.current_price) : 0;
    const currentTotalValue = totalLots * currentPrice;
    const profitLoss = currentTotalValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
    const isProfit = profitLoss >= 0;

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!assetData) {
        return (
            <div className="min-h-screen  flex flex-col items-center justify-center text-white px-4">
                <Activity className="w-16 h-16 mb-4 text-slate-600" />
                <h1 className="text-3xl font-bold mb-2">Varlık Bulunamadı</h1>
                <p className="text-slate-400 mb-6 text-center max-w-md">Aradığınız varlık ({rawSymbol}) sistemimizde bulunmuyor veya geçici olarak ulaşılamıyor.</p>
                <button onClick={() => router.push('/')} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-medium transition">Ana Sayfaya Dön</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen  text-slate-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>


                    {user || (typeof window !== 'undefined' && localStorage.getItem('is_logged_in') === 'true') ? (
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition"
                        >
                            <Plus className="w-5 h-5 mr-1" />
                            İşlem Ekle
                        </button>
                    ) : (
                        <button 
                            onClick={() => router.push('/register')}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition"
                        >
                            Hesap Oluştur
                        </button>
                    )}
                </div>

                {/* Asset Info Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-row items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-3">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                                    {assetData?.symbol || rawSymbol}
                                    <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider border border-indigo-500/20">
                                        {assetData?.asset_type}
                                    </span>
                                </h1>
                                <p className="text-slate-400 mt-1 md:text-lg">{assetData?.name || 'Yükleniyor...'}</p>
                            </div>
                        </div>
                    </div>
                    
                    {assetData && (
                        <div className="md:text-right">
                            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white flex items-center md:justify-end gap-2">
                                {assetData.current_price} ₺
                                {fundamentals?.isStale && (
                                    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20 whitespace-nowrap">
                                        {fundamentals.staleMessage}
                                    </span>
                                )}
                            </p>
                            
                            {periodReturn !== null ? (
                                <p className={`flex items-center md:justify-end text-lg mt-1 font-medium ${periodReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={`Seçili dönem getirisi`}>
                                    {periodReturn >= 0 ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                                    {periodReturn > 0 ? '+' : ''}{periodReturn.toFixed(2)}%
                                    <span className="text-xs text-slate-400 ml-2 font-normal">({
                                        timeRange === '1D' ? 'Günlük' : 
                                        timeRange === '1W' ? 'Haftalık' : 
                                        timeRange === '1M' ? 'Aylık' : 
                                        timeRange === '3M' ? '3 Aylık' : 
                                        timeRange === '6M' ? '6 Aylık' : 
                                        timeRange === 'YTD' ? 'Yılbaşından Beri' : 
                                        timeRange === '1Y' ? 'Yıllık' : 
                                        timeRange === '3Y' ? '3 Yıllık' : 
                                        timeRange === '5Y' ? '5 Yıllık' : 'Özel Aralık'
                                    })</span>
                                </p>
                            ) : (
                                <p className={`flex items-center md:justify-end text-lg mt-1 font-medium ${assetData.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {assetData.positive ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                                    {assetData.change}%
                                    <span className="text-xs text-slate-400 ml-2 font-normal">(Günlük)</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Flex Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Left Col: Chart & Stats (Wider) */}
                    <div className="flex-1 flex flex-col gap-6">
                        
                        {/* CHART */}
                        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 min-h-96 flex flex-col">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0 w-full">
                                <h3 className="text-lg font-bold text-white flex items-center shrink-0">
                                    <Activity className="w-5 h-5 mr-2 text-indigo-400" />
                                    Fiyat Grafiği
                                </h3>
                                <div className="flex bg-slate-800 rounded-lg p-1 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                                    {['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y']
                                        .filter(r => {
                                            if (r === '1D') {
                                                return assetData && assetData.asset_type !== 'FON';
                                            }
                                            return true;
                                        })
                                        .map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setTimeRange(r)}
                                            className={`px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition shrink-0 ${timeRange === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                                        >
                                            {r === '1D' ? 'Günlük' : r === '1W' ? 'Haftalık' : r === '1M' ? 'Aylık' : r === '3M' ? '3 Aylık' : r === '6M' ? '6 Aylık' : r === 'YTD' ? 'YBB' : r === '1Y' ? 'Yıllık' : r === '3Y' ? '3 Yıllık' : r === '5Y' ? '5 Yıllık' : 'Özel'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex-1 w-full min-h-0 relative">
                                <div className="absolute inset-0">
                                    {isChartLoading ? (
                                        <LoadingSpinner fullScreen={false} message="Grafik yükleniyor..." />
                                    ) : chartData && chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#94a3b8" 
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis 
                                                domain={['auto', 'auto']} 
                                                stroke="#94a3b8" 
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => value.toFixed(2)}
                                            />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                                itemStyle={{ color: '#818cf8' }}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="price" 
                                                stroke="#6366f1" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorPrice)" 
                                            />
                                            <Brush 
                                                dataKey="date" 
                                                height={30} 
                                                stroke="#6366f1" 
                                                fill="#1e293b" 
                                                onChange={handleBrushChange}
                                                tickFormatter={(date) => date}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    ) : assetData?.asset_type === 'FON' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-center px-4">
                                        <Activity className="w-16 h-16 mb-4 opacity-30" />
                                        <p className="text-lg font-medium text-slate-400">Devlet (TEFAS) API'si geçici olarak kısıtlandığı için fon grafikleri çekilemiyor.</p>
                                        <p className="text-sm mt-2 text-slate-500">BIST hisseleri ve Döviz kurları sorunsuz çalışmaktadır.</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-slate-500">Grafik Yükleniyor Veya Veri Bulunamadı...</span>
                                    </div>
                                )}
                                </div>
                            </div>
                        </div>

                        {/* PORTFOLIO SNAPSHOT (If holding) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shrink-0">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
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
                                    {(user || (typeof window !== 'undefined' && localStorage.getItem('is_logged_in') === 'true')) && (
                                        <button 
                                            onClick={() => setIsModalOpen(true)}
                                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition underline"
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
                                <History className="w-5 h-5 mr-2 text-indigo-400" />
                                İşlem Geçmişi
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            {!(user || (typeof window !== 'undefined' && localStorage.getItem('is_logged_in') === 'true')) ? (
                                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                                    <History className="w-12 h-12 mb-3 opacity-20" />
                                    <p>İşlem geçmişinizi görmek için ücretsiz hesap açın.</p>
                                    <button onClick={() => router.push('/register')} className="text-indigo-400 hover:text-indigo-300 hover:underline mt-3 text-sm transition font-medium">Hesap Oluştur</button>
                                </div>
                            ) : loading ? (
                                <p className="text-center text-slate-500 py-8">Yükleniyor...</p>
                            ) : transactions.length === 0 ? (
                                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                                    <p>Henüz işlem geçmişi yok.</p>
                                    <button onClick={() => setIsModalOpen(true)} className="text-indigo-400 hover:text-indigo-300 hover:underline mt-3 text-sm transition">İlk işlemini ekle</button>
                                </div>
                            ) : (
                                transactions.map((tx) => {
                                    const txType = tx.Type || tx.type;
                                    const txAmount = tx.Amount || tx.amount;
                                    const txPrice = tx.Price || tx.price;
                                    const txDate = tx.TransactionDate || tx.transaction_date;
                                    const txRealizedPnl = tx.RealizedPnl || tx.realized_pnl || '0';
                                    
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
                                                    onClick={() => handleDelete(tx.ID || tx.id)}
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

                {/* DIV 9: Bottom Row: Temel Bilgiler (Spans across full width below the flex container) */}
                {fundamentals && (
                    <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-indigo-400" />
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-5 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <Activity className="w-5 h-5 mr-2 text-indigo-400" />
                                İşlem Ekle ({rawSymbol})
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        placeholder={assetData?.current_price ? assetData.current_price.toString() : "0.00"}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tarih ve Saat</label>
                                <input 
                                    type="datetime-local" 
                                    required
                                    max={new Date().toISOString().slice(0, 16)}
                                    value={txDate}
                                    onChange={e => setTxDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Ödenen Komisyon (₺) - Opsiyonel</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    value={txCommission}
                                    onChange={e => setTxCommission(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="0.00"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                    background: rgba(99, 102, 241, 0.8); 
                }
            `}</style>
        </div>
    );
}
