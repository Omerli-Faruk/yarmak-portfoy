'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Activity, Bell, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { InteractiveAreaChart } from '@/components/InteractiveAreaChart';
import AddTransactionModal from '@/components/holdings/AddTransactionModal';
import AssetHeaderCard from '@/components/asset-detail/AssetHeaderCard';
import PositionCard from '@/components/asset-detail/PositionCard';
import AssetTxHistory from '@/components/asset-detail/AssetTxHistory';
import FundamentalsGrid from '@/components/asset-detail/FundamentalsGrid';
import {
    AssetChartItem,
    AssetDetailInfo,
    AssetFundamentals,
    formatIndexPoints,
    isIndexAsset,
} from '@/components/asset-detail/types';
import { formatPriceTR } from '@/lib/formatters';
import { normalizeTransaction } from '@/lib/normalize';
import { CHART_PERIODS } from '@/lib/periodUtils';
import type { NormalizedTransaction, Transaction } from '@/types';

// Eldeki lot ve ortalama maliyet. Alışta komisyon maliyete eklenir;
// satışta maliyet, satılan lot kadar ortalama fiyattan düşülür.
function calculateHolding(txs: NormalizedTransaction[]) {
    let totalLots = 0;
    let totalCost = 0;

    // Eskiden yeniye sırala
    const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const tx of sorted) {
        if (tx.type === 'BUY') {
            totalCost += (tx.amount * tx.price) + tx.commission;
            totalLots += tx.amount;
        } else if (tx.type === 'SELL') {
            if (totalLots > 0) {
                const avgCostPerShare = totalCost / totalLots;
                totalCost -= (avgCostPerShare * tx.amount);
                totalLots -= tx.amount;
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

    const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [assetData, setAssetData] = useState<AssetDetailInfo | null>(null);
    const [chartData, setChartData] = useState<AssetChartItem[]>([]);
    const [fundamentals, setFundamentals] = useState<AssetFundamentals | null>(null);
    const [summaryData, setSummaryData] = useState<Record<string, number> | null>(null);
    const [timeRange, setTimeRange] = useState('1M'); // CHART_PERIODS içindeki id'lerden biri
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Grafikte seçili dönemin getirisi (%)
    const [periodReturn, setPeriodReturn] = useState<number | null>(null);

    // AuthProvider oturum kontrolü bitene kadar sayfayı göstermediği için user burada güncel
    const isLoggedIn = !!user;

    const loadAssetAndTransactions = async () => {
        try {
            setLoading(true);
            // Varlığın adı, türü ve son fiyatı
            const assetRes = await fetch(`/api/assets?q=${encodeURIComponent(rawSymbol)}`);
            if (assetRes.ok) {
                const results = await assetRes.json();
                const matched = results.find((r: AssetDetailInfo) => r.symbol === rawSymbol);
                if (matched) setAssetData(matched);
            }

            // Kullanıcının bu varlıktaki işlemleri
            if (isLoggedIn) {
                try {
                    const txRes = await api.get<Transaction[]>('/transactions?limit=1000');
                    if (txRes.data) {
                        setTransactions(txRes.data.map(normalizeTransaction).filter(t => t.symbol === rawSymbol));
                    }
                } catch {
                    console.log('Misafir veya token geçersiz');
                }
            }
        } catch (error) {
            console.error('Varlık veya işlemler alınamadı:', error);
        } finally {
            setLoading(false);
        }
    };

    const [pollCount, setPollCount] = useState(0);

    const chartCacheRef = useRef<Record<string, { chart: AssetChartItem[]; timestamp: number }>>({});

    const loadChartAndFundamentals = async () => {
        // Bu dönemin grafiği bellekte varsa hemen göster. 45 saniyeden yeniyse tekrar istek atma.
        const cached = chartCacheRef.current[timeRange];
        if (cached && cached.chart && cached.chart.length > 0) {
            setChartData(cached.chart);
            setIsChartLoading(false);
            if (timeRange === '1D' && summaryData?.['1D'] !== undefined && !isNaN(summaryData['1D'])) {
                setPeriodReturn(summaryData['1D']);
            } else {
                const firstPrice = Number(cached.chart[0]?.price || 0);
                const lastPrice = Number(cached.chart[cached.chart.length - 1]?.price || 0);
                if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                    setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
                }
            }
            if (Date.now() - cached.timestamp < 45000) {
                return;
            }
        } else {
            setIsChartLoading(true);
        }

        try {
            const url = `/api/assets/detail?symbol=${encodeURIComponent(rawSymbol)}&range=${encodeURIComponent(timeRange)}`;
            const detailRes = await fetch(url);
            if (detailRes.ok) {
                const det = await detailRes.json();
                if (det.chart && det.chart.length > 0) {
                    setChartData(det.chart);
                    chartCacheRef.current[timeRange] = { chart: det.chart, timestamp: Date.now() };
                    setPollCount(0);

                    // Dönem getirisi: 1G için özet verisi, diğer dönemlerde grafiğin ilk ve son noktası
                    if (timeRange === '1D' && det.summary?.['1D'] !== undefined && !isNaN(det.summary['1D'])) {
                        setPeriodReturn(det.summary['1D']);
                    } else {
                        const firstPrice = Number(det.chart[0]?.price || 0);
                        const lastPrice = Number(det.chart[det.chart.length - 1]?.price || 0);
                        if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
                            setPeriodReturn(((lastPrice - firstPrice) / firstPrice) * 100);
                        } else {
                            setPeriodReturn(null);
                        }
                    }
                } else if (!cached) {
                    setChartData([]);
                    setPeriodReturn(null);

                    // Veri yoksa backend geçmiş fiyatları kuyruğa almıştır; 3 saniyede bir, en fazla 15 kez tekrar dene
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
                        // Noktalı ondalık metin olarak tutulur; ekranda formatPriceTR ile biçimlenir
                        const formattedPrice = lastPt.price >= 1 ? lastPt.price.toFixed(2) : lastPt.price.toFixed(4);
                        setAssetData(prev => prev ? { ...prev, current_price: formattedPrice } : prev);
                    }
                }
                if (det.fundamentals) setFundamentals(det.fundamentals);
                if (det.summary) setSummaryData(det.summary);
            }
        } catch (error) {
            console.error('Grafik ve temel veriler alınamadı:', error);
        } finally {
            setIsChartLoading(false);
        }
    };


    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadAssetAndTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawSymbol]);

    useEffect(() => {
        void loadChartAndFundamentals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawSymbol, timeRange, pollCount]);

    const handleDelete = async (id: number) => {
        if (!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            await loadAssetAndTransactions();
        } catch (error: unknown) {
            const e = error as { response?: { data?: { error?: string } } };
            alert(e.response?.data?.error || 'Silinirken hata oluştu');
        }
    };

    const { totalLots, avgCost, totalCost } = calculateHolding(transactions);
    const currentPrice = assetData?.current_price ? parseFloat(assetData.current_price) : 0;
    const currentTotalValue = totalLots * currentPrice;
    const profitLoss = currentTotalValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

    const isFund = assetData?.asset_type === 'FON';
    const isIndex = isIndexAsset(rawSymbol, assetData?.asset_type);

    // Fonlarda gün içi fiyat olmadığı için 1G yok. Bu sayfada Tümü seçeneği gösterilmiyor.
    const assetPeriods = useMemo(
        () => CHART_PERIODS.filter(p => p.id !== 'ALL' && !(isFund && p.id === '1D')),
        [isFund]
    );

    const formattedChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        return chartData.map(pt => ({
            date: pt.date,
            value: typeof pt.price === 'number' ? pt.price : parseFloat(String(pt.price || 0)),
            raw: typeof pt.price === 'number' ? pt.price : parseFloat(String(pt.price || 0)),
        }));
    }, [chartData]);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!assetData) {
        return (
            <div className="min-h-screen  flex flex-col items-center justify-center text-white px-4">
                <Activity className="w-16 h-16 mb-4 text-slate-600" />
                <h1 className="text-3xl font-bold mb-2">Varlık bulunamadı</h1>
                <p className="text-slate-400 mb-6 text-center max-w-md">Aradığınız varlık ({rawSymbol}) sistemimizde bulunmuyor veya geçici olarak ulaşılamıyor.</p>
                <button onClick={() => router.push('/')} className="bg-[#1A9FD3] hover:bg-[#1589B7] px-6 py-2 rounded-lg font-medium transition cursor-pointer">Ana Sayfaya Dön</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Üst bar: geri dönüş, alarm ve işlem ekleme */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>


                    {isLoggedIn ? (
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/alerts?symbol=${encodeURIComponent(rawSymbol)}`}
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-amber-500/50 text-slate-200 hover:text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center transition cursor-pointer gap-1.5"
                                title="Fiyat Alarmı Kur"
                            >
                                <Bell className="w-3.5 h-3.5 text-amber-400" />
                                <span>Alarm Kur</span>
                            </Link>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center transition cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
                            >
                                <Plus className="w-4 h-4 mr-1 stroke-[2.5]" />
                                İşlem Ekle
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => router.push('/register')}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center transition cursor-pointer"
                        >
                            Hesap Oluştur
                        </button>
                    )}
                </div>

                <AssetHeaderCard
                    assetData={assetData}
                    rawSymbol={rawSymbol}
                    fundamentals={fundamentals}
                    summaryData={summaryData}
                    periodReturn={periodReturn}
                    onRefreshStale={() => {
                        chartCacheRef.current = {};
                        void loadChartAndFundamentals();
                    }}
                />

                {/* Solda grafik ve pozisyon, sağda işlem geçmişi */}
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 flex flex-col gap-6">
                        <InteractiveAreaChart
                            title="Fiyat Grafiği"
                            data={formattedChartData}
                            dataKey="value"
                            dateKey="date"
                            periods={assetPeriods}
                            activePeriod={timeRange}
                            onPeriodChange={setTimeRange}
                            currencySymbol={isIndex ? '' : '₺'}
                            currency="TRY"
                            valueFormatter={isIndex ? formatIndexPoints : formatPriceTR}
                            showBrush={true}
                            showStats={true}
                            isLoading={isChartLoading}
                            emptyMessage={
                                isFund
                                    ? "Fon fiyat verileri hazırlanıyor, lütfen birkaç saniye bekleyin..."
                                    : "Grafik verisi yükleniyor veya veri bulunamadı..."
                            }
                        />

                        <PositionCard
                            totalLots={totalLots}
                            avgCost={avgCost}
                            totalValue={currentTotalValue}
                            profitLoss={profitLoss}
                            profitLossPercent={profitLossPercent}
                            canAdd={isLoggedIn}
                            onAddTx={() => setIsModalOpen(true)}
                        />
                    </div>

                    <AssetTxHistory
                        isLoggedIn={isLoggedIn}
                        transactions={transactions}
                        onRegister={() => router.push('/register')}
                        onAddTx={() => setIsModalOpen(true)}
                        onDelete={handleDelete}
                    />
                </div>

                {/* Temel veriler yalnızca hisselerde gösterilir */}
                {fundamentals && assetData.asset_type === 'HISSE' && (
                    <FundamentalsGrid fundamentals={fundamentals} />
                )}

                {/* Yasal uyarı ve gecikme notu */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Fiyatlar genel bilgilendirme amaçlıdır ve yatırım tavsiyesi değildir. BIST verileri en az 15 dakika gecikmelidir.</span>
                    </div>
                    <Link href="/disclaimer" className="text-primary hover:underline shrink-0 text-[11px] font-semibold">
                        Yasal Uyarı &rarr;
                    </Link>
                </div>
            </div>

            <AddTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadAssetAndTransactions}
                initialSymbol={rawSymbol}
                initialPrice={assetData.current_price ?? ''}
                assetType={assetData.asset_type || 'HISSE'}
            />
        </div>
    );
}
