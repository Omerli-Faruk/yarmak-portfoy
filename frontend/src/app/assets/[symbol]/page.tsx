'use client';

import React, { useEffect, useState, useRef, useMemo, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Activity, Bell } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageContainer from '@/components/ui/PageContainer';
import Button, { buttonClasses } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
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
import { formatPriceTR, formatTRY, priceDecimals } from '@/lib/formatters';
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

// Masaüstünde grafik daha uzun çizilir; sunucuda ve ilk çizimde dar ekran varsayılır
const WIDE_QUERY = '(min-width: 1024px)';
function subscribeWide(onChange: () => void) {
    const mq = window.matchMedia(WIDE_QUERY);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
}
function useIsWide() {
    return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
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
    // Önceki kapanış: 1G grafiğinde kesikli referans çizgisi, 1G getirisi buna göre
    const [previousClose, setPreviousClose] = useState<number | null>(null);
    const isWide = useIsWide();

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
                setPreviousClose(typeof det.previousClose === 'number' && det.previousClose > 0 ? det.previousClose : null);
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

    // Fonlarda gün içi fiyat olmadığı için 1G yok
    const assetPeriods = useMemo(
        () => CHART_PERIODS.filter(p => !(isFund && p.id === '1D')),
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
            <PageContainer width="narrow" className="min-h-[60vh] justify-center">
                <EmptyState
                    icon={<Activity />}
                    title={<span role="heading" aria-level={1}>Varlık bulunamadı</span>}
                    description={`Aradığınız varlık (${rawSymbol}) sistemimizde bulunmuyor veya geçici olarak ulaşılamıyor.`}
                    action={<Button onClick={() => router.push('/')}>Ana sayfaya dön</Button>}
                />
            </PageContainer>
        );
    }

    // Temel veriler yalnızca hisselerde gösterilir
    const showFundamentals = !!fundamentals && assetData.asset_type === 'HISSE';

    // Pozisyon yalnızca bu varlıkta işlemi olan kullanıcıya gösterilir. Misafirde ve hiç işlemi olmayanda
    // "işlem yok" bilgisi zaten İşlemleriniz bölümünde yazdığı için ikinci bir boş kutu çıkmaz.
    const showPosition = isLoggedIn && transactions.length > 0;
    const position = showPosition ? (
        <PositionCard
            totalLots={totalLots}
            avgCost={avgCost}
            totalValue={currentTotalValue}
            profitLoss={profitLoss}
            profitLossPercent={profitLossPercent}
        />
    ) : null;

    return (
        <PageContainer>
            {/* Odak: sembol satırı, büyük fiyat, kutusuz grafik ve dönem getirileri */}
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
                actions={
                    isLoggedIn ? (
                        <>
                            <Link
                                href={`/alerts?symbol=${encodeURIComponent(rawSymbol)}`}
                                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                            >
                                <Bell aria-hidden />
                                <span>Alarm kur</span>
                            </Link>
                            <Button size="sm" leftIcon={<Plus />} onClick={() => setIsModalOpen(true)}>
                                İşlem ekle
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" size="sm" onClick={() => router.push('/register')}>
                            Hesap oluştur
                        </Button>
                    )
                }
            >
                <InteractiveAreaChart
                    frameless
                    title="Fiyat grafiği"
                    data={formattedChartData}
                    dataKey="value"
                    dateKey="date"
                    periods={assetPeriods}
                    activePeriod={timeRange}
                    onPeriodChange={setTimeRange}
                    currencySymbol={isIndex ? '' : '₺'}
                    currency="TRY"
                    valueFormatter={isIndex ? formatIndexPoints : formatPriceTR}
                    referenceValue={timeRange === '1D' ? previousClose : null}
                    referenceLabel="Önceki kapanış"
                    // Dönem farkı fiyatla aynı hanede: "−11,75 ₺", kuruşluk fonda "+0,0012 ₺"
                    changeFormatter={isIndex ? undefined : (v) => formatTRY(v, priceDecimals(currentPrice), true)}
                    showBrush={true}
                    showStats={true}
                    isLoading={isChartLoading}
                    height={isWide ? 380 : 260}
                    emptyMessage={
                        isFund
                            ? "Fon fiyat verileri hazırlanıyor, lütfen birkaç saniye bekleyin..."
                            : "Grafik verisi yükleniyor veya veri bulunamadı..."
                    }
                />
            </AssetHeaderCard>

            {/* Ana sütunda pozisyon ve işlemler, dar yan sütunda temel veriler. Temel verisi olmayan
                varlıklarda (altın, fon, endeks) kısa pozisyon listesi yan sütuna geçer; böylece etiket ile
                değer tam genişlikte birbirinden kopmaz. Telefonda pozisyon yine işlemlerin üstündedir. */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-10">
                <div className="flex flex-col gap-10 min-w-0 lg:basis-0 lg:grow">
                    {showFundamentals && position}

                    {/* Boş durumda ayrı düğme yok: "Hesap oluştur" / "İşlem ekle" fiyatın yanında */}
                    <AssetTxHistory
                        isLoggedIn={isLoggedIn}
                        transactions={transactions}
                        onDelete={handleDelete}
                    />
                </div>

                {showFundamentals ? (
                    <FundamentalsGrid fundamentals={fundamentals} className="w-full lg:w-[340px] shrink-0" />
                ) : (
                    position && <div className="order-first lg:order-none w-full lg:w-[340px] shrink-0">{position}</div>
                )}
            </div>

            {/* Yasal uyarı ve gecikme notu sitenin alt bilgisinde; fiyatın yanında kaynağa göre kısa not var */}
            <AddTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadAssetAndTransactions}
                initialSymbol={rawSymbol}
                initialPrice={assetData.current_price ?? ''}
                assetType={assetData.asset_type || 'HISSE'}
            />
        </PageContainer>
    );
}
