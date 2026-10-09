'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    Layers,
    RefreshCw,
    CheckCircle2,
    Clock,
    ShieldAlert
} from 'lucide-react';
import AddTransactionModal from '@/components/holdings/AddTransactionModal';
import IndexStrip from '@/components/markets/IndexStrip';
import MarketLeaderColumn from '@/components/markets/MarketLeaderColumn';
import MarketScreener, { type MarketCategory, type MarketSort } from '@/components/markets/MarketScreener';
import type { MarketAssetItem, MarketIndexItem } from '@/types';

export default function MarketsPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [indices, setIndices] = useState<MarketIndexItem[]>([]);
    const [topGainers, setTopGainers] = useState<MarketAssetItem[]>([]);
    const [topLosers, setTopLosers] = useState<MarketAssetItem[]>([]);
    const [mostActive, setMostActive] = useState<MarketAssetItem[]>([]);
    const [screenerItems, setScreenerItems] = useState<MarketAssetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filtreler
    const [selectedCategory, setSelectedCategory] = useState<MarketCategory>('ALL');
    const [selectedSort, setSelectedSort] = useState<MarketSort>('gainers');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [totalFound, setTotalFound] = useState<number | null>(null);

    // Her tuşta istek atmamak için arama 200 ms bekletilir
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Hızlı işlem ekleme penceresi bu varlık için açılır; null ise kapalıdır
    const [quickAddAsset, setQuickAddAsset] = useState<MarketAssetItem | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    const fetchMarketData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const url = `/api/markets?category=${selectedCategory}&sort=${selectedSort}&search=${encodeURIComponent(debouncedSearch)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setIndices(data.indices || []);
                setTopGainers(data.topGainers || []);
                setTopLosers(data.topLosers || []);
                setMostActive(data.mostActive || []);
                setScreenerItems(data.screener || []);
                setTotalFound(typeof data.totalCount === 'number' ? data.totalCount : (data.screener?.length || 0));
            }
        } catch (err) {
            console.error('Piyasa verisi çekme hatası:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedCategory, selectedSort, debouncedSearch]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchMarketData();
    }, [fetchMarketData]);

    const handleOpenQuickModal = (asset: MarketAssetItem) => {
        if (!user) {
            router.push('/login');
            return;
        }
        setSuccessMessage(null);
        setQuickAddAsset(asset);
    };

    const quickAddPrice = quickAddAsset && quickAddAsset.price > 0
        ? (quickAddAsset.price >= 100 ? quickAddAsset.price.toFixed(2) : quickAddAsset.price.toFixed(4))
        : '';

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Başlık ve yenile */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <Activity className="size-6 text-[#1A9FD3]" />
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Piyasalar & Varlık Keşfi
                            </h1>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-2xl">
                            Borsa İstanbul hisseleri, TEFAS yatırım fonları, altın ve döviz piyasalarında günün öne çıkanlarını ve en çok kazandıranlarını keşfedin.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/disclaimer"
                            title="Borsa İstanbul pay piyasası verileri en az 15 dakika gecikmelidir. Yatırım tavsiyesi değildir."
                            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                        >
                            <Clock className="size-3.5 text-amber-400" />
                            <span>BIST 15 Dk. Gecikmeli</span>
                        </Link>
                        <button
                            onClick={() => fetchMarketData(true)}
                            disabled={refreshing}
                            className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin text-[#1A9FD3]' : ''}`} />
                            <span>{refreshing ? 'Yenileniyor...' : 'Verileri Yenile'}</span>
                        </button>
                    </div>
                </div>

                <IndexStrip indices={indices} />

                {/* Yükselenler, düşenler ve seçili hisseler */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MarketLeaderColumn
                        title="Günün Yükselenleri"
                        subtitle="En çok artanlar"
                        icon={<TrendingUp className="size-4" />}
                        items={topGainers}
                        loading={loading}
                        emptyText="Gösterilecek yükselen hisse yok."
                        keyPrefix="gain"
                        onQuickAdd={handleOpenQuickModal}
                    />
                    <MarketLeaderColumn
                        title="Günün Düşenleri"
                        subtitle="En çok düşenler"
                        icon={<TrendingDown className="size-4" />}
                        items={topLosers}
                        loading={loading}
                        emptyText="Gösterilecek düşen hisse yok."
                        keyPrefix="loss"
                        onQuickAdd={handleOpenQuickModal}
                    />
                    {/* Liste API'deki sabit bir hisse seçkisinden gelir, takip ya da hacim verisine dayanmaz */}
                    <MarketLeaderColumn
                        title="Seçili Hisseler"
                        subtitle="Sabit BIST listesi"
                        icon={<Layers className="size-4" />}
                        items={mostActive}
                        loading={loading}
                        emptyText="Gösterilecek hisse yok."
                        keyPrefix="pop"
                        onQuickAdd={handleOpenQuickModal}
                    />
                </div>

                <MarketScreener
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    category={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    sort={selectedSort}
                    onSortChange={setSelectedSort}
                    debouncedSearch={debouncedSearch}
                    totalFound={totalFound}
                    loading={loading}
                    items={screenerItems}
                    onQuickAdd={handleOpenQuickModal}
                />

                {/* Gecikme ve yatırım tavsiyesi uyarısı */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                            <ShieldAlert className="size-4" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="font-semibold text-slate-200">
                                BIST Verileri 15 Dakika Gecikmelidir &bull; Yatırım Tavsiyesi Değildir
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Piyasa verileri ve fiyatlar genel bilgilendirme amaçlıdır; anlık aracı kurum emir fiyatlarınızdan veya gerçekleşen işlemlerinizden farklılık gösterebilir.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/disclaimer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold shrink-0 transition"
                    >
                        <span>Detaylı Yasal Uyarı</span>
                        <span>&rarr;</span>
                    </Link>
                </div>
            </div>

            <AddTransactionModal
                isOpen={quickAddAsset !== null}
                onClose={() => setQuickAddAsset(null)}
                onSuccess={() => setSuccessMessage('İşlem portföyünüze eklendi.')}
                initialSymbol={quickAddAsset?.symbol ?? ''}
                initialPrice={quickAddPrice}
                assetType={quickAddAsset?.asset_type ?? 'HISSE'}
            />

            {successMessage && (
                <div
                    role="status"
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl"
                >
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
        </div>
    );
}
