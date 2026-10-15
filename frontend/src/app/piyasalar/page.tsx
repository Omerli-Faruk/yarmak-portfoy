'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    ArrowRight,
    RefreshCw,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';
import Button, { buttonClasses } from '@/components/ui/Button';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';
import AddTransactionModal from '@/components/holdings/AddTransactionModal';
import IndexStrip from '@/components/markets/IndexStrip';
import MarketLeaderColumn from '@/components/markets/MarketLeaderColumn';
import MarketScreener, { type MarketCategory, type MarketSort } from '@/components/markets/MarketScreener';
import type { MarketAssetItem, MarketIndexItem } from '@/types';

// Yükselenler ve düşenler geniş ekranda iki eşit sütun, dar ekranda alt alta
const LEADER_COLUMN_CLASSES = 'lg:basis-0 lg:grow';

export default function MarketsPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [indices, setIndices] = useState<MarketIndexItem[]>([]);
    const [topGainers, setTopGainers] = useState<MarketAssetItem[]>([]);
    const [topLosers, setTopLosers] = useState<MarketAssetItem[]>([]);
    // API'nin "mostActive" seçkisi ayrı liste olarak gösterilmez; aynı hisseler
    // keşif listesinde "Seçili hisseler önce" sıralamasıyla başa gelir
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
            router.push('/giris');
            return;
        }
        setSuccessMessage(null);
        setQuickAddAsset(asset);
    };

    const quickAddPrice = quickAddAsset && quickAddAsset.price > 0
        ? (quickAddAsset.price >= 100 ? quickAddAsset.price.toFixed(2) : quickAddAsset.price.toFixed(4))
        : '';

    return (
        <PageContainer>
            <PageHeader
                title="Piyasalar"
                subtitle="Borsa İstanbul hisseleri, TEFAS fonları, altın ve döviz."
                actions={
                    // Gecikme notu sayfanın sonundaki uyarıda bir kez yazılır
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchMarketData(true)}
                        disabled={refreshing}
                        leftIcon={<RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />}
                    >
                        {refreshing ? 'Yenileniyor...' : 'Yenile'}
                    </Button>
                }
            />

            <IndexStrip indices={indices} loading={loading} />

            {/* Yükselenler ve düşenler: en çok iki sütun */}
            <div className="flex flex-col gap-10 lg:flex-row">
                <MarketLeaderColumn
                    title="Günün yükselenleri"
                    items={topGainers}
                    loading={loading}
                    emptyText="Gösterilecek yükselen hisse yok."
                    keyPrefix="gain"
                    onQuickAdd={handleOpenQuickModal}
                    className={LEADER_COLUMN_CLASSES}
                />
                <MarketLeaderColumn
                    title="Günün düşenleri"
                    items={topLosers}
                    loading={loading}
                    emptyText="Gösterilecek düşen hisse yok."
                    keyPrefix="loss"
                    onQuickAdd={handleOpenQuickModal}
                    className={LEADER_COLUMN_CLASSES}
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

            {/* Gecikme ve yatırım tavsiyesi uyarısı: kutusuz, sayfanın sonunda sakin bir not */}
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 size-[18px] shrink-0 text-warning" aria-hidden />
                    <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium text-fg">
                            BIST verileri 15 dakika gecikmelidir &bull; Yatırım tavsiyesi değildir
                        </p>
                        <p className="text-xs leading-relaxed text-fg-muted">
                            Piyasa verileri ve fiyatlar genel bilgilendirme amaçlıdır; anlık aracı kurum emir fiyatlarınızdan veya gerçekleşen işlemlerinizden farklılık gösterebilir.
                        </p>
                    </div>
                </div>
                <Link href="/yasal-uyari" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'shrink-0 self-start sm:self-auto' })}>
                    <span>Yasal uyarı</span>
                    <ArrowRight aria-hidden />
                </Link>
            </div>

            <AddTransactionModal
                isOpen={quickAddAsset !== null}
                onClose={() => setQuickAddAsset(null)}
                onSuccess={() => setSuccessMessage('İşlem portföyünüze eklendi.')}
                initialSymbol={quickAddAsset?.symbol ?? ''}
                initialPrice={quickAddPrice}
                assetType={quickAddAsset?.asset_type ?? 'HISSE'}
            />

            {/* Mobilde alt sekme çubuğunun üstünde durur */}
            {successMessage && (
                <div
                    role="status"
                    className="fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm font-medium text-fg sm:bottom-6"
                >
                    <CheckCircle2 className="size-4 shrink-0 text-profit" aria-hidden />
                    <span>{successMessage}</span>
                </div>
            )}
        </PageContainer>
    );
}
