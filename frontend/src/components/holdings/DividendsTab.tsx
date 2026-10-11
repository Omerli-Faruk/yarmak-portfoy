'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dividend, UserHolding } from '@/types';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { normalizeDividend } from '@/lib/normalize';
import Disclosure from '@/components/ui/Disclosure';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import AddDividendModal from './AddDividendModal';
import DividendSummaryCards, { DividendMetrics } from './dividends/DividendSummaryCards';
import DividendFilterBar from './dividends/DividendFilterBar';
import DividendList, { DividendRow } from './dividends/DividendList';
import DeleteDividendModal from './dividends/DeleteDividendModal';
import ListPagination from './transactions/ListPagination';
import { Coins, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DividendsTabProps {
    currency: 'TRY' | 'USD';
    // Kur yoksa (null ya da 0) tutarlar TL gösterilir
    usdRate: number | null;
    holdings: UserHolding[];
    onRefreshHoldings: () => void;
}

// Bir sayfada gösterilen kayıt sayısı
const PAGE_SIZE = 12;

function yearOf(dateStr: string): string | null {
    if (!dateStr) return null;
    const year = new Date(dateStr).getFullYear();
    return isNaN(year) ? null : String(year);
}

export default function DividendsTab({
    currency,
    usdRate,
    holdings,
    onRefreshHoldings,
}: DividendsTabProps) {
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);

    // Filtreler ve sayfa
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Silme onayı
    const [deletingDividend, setDeletingDividend] = useState<DividendRow | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

    const loadDividends = useCallback(async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            const res = await api.get<Dividend[]>('/dividends');
            setDividends(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Temettü verileri yüklenemedi:', err);
            setDividends([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDividends();
    }, [loadDividends]);

    const handleConfirmDelete = async () => {
        if (!deletingDividend) return;
        const divId = deletingDividend.id;
        if (!divId) return;

        setDeleteSubmitting(true);
        setDeleteError(null);
        try {
            await api.delete(`/dividends/${divId}`);
            // Son kayıt silinse bile listeden hemen kaldırılır, ardından liste yeniden yüklenir
            setDividends(prev => prev.filter(d => (d.ID || d.id) !== divId));
            setDeleteSuccessMsg('Temettü kaydı başarıyla silindi.');
            setTimeout(() => setDeleteSuccessMsg(null), 3000);
            setDeletingDividend(null);
            await loadDividends();
            onRefreshHoldings();
        } catch (err: unknown) {
            console.error('Temettü silinirken hata:', err);
            setDeleteError('Temettü silinemedi. Lütfen tekrar deneyin.');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const rows = useMemo<DividendRow[]>(
        () => dividends.map(d => ({ ...normalizeDividend(d), raw: d })),
        [dividends]
    );

    const availableYears = useMemo(() => {
        const yearsSet = new Set<string>();
        rows.forEach(d => {
            const year = yearOf(d.date);
            if (year) yearsSet.add(year);
        });
        return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
    }, [rows]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return rows.filter(d => {
            if (q && !d.symbol.toLowerCase().includes(q) && !d.assetName.toLowerCase().includes(q)) {
                return false;
            }
            // Tarihi olmayan kayıtlar yıl filtresinden etkilenmez
            if (selectedYear !== 'ALL' && d.date) {
                if (String(new Date(d.date).getFullYear()) !== selectedYear) return false;
            }
            return true;
        });
    }, [rows, searchQuery, selectedYear]);

    const metrics = useMemo<DividendMetrics>(() => {
        let totalGross = 0;
        let totalTax = 0;
        let totalNet = 0;
        const uniqueSymbols = new Set<string>();

        filteredRows.forEach(d => {
            totalGross += d.gross;
            totalTax += d.tax;
            totalNet += d.net;
            if (d.symbol) uniqueSymbols.add(d.symbol);
        });

        return {
            totalGross,
            totalTax,
            totalNet,
            uniqueAssetsCount: uniqueSymbols.size,
            totalCount: filteredRows.length,
        };
    }, [filteredRows]);

    const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRows.slice(start, start + PAGE_SIZE);
    }, [filteredRows, currentPage]);

    const fmt = (val: number, showPlus = false) => formatCurrency(val, currency, usdRate, showPlus);

    const hasActiveFilters = !!searchQuery || selectedYear !== 'ALL';

    return (
        <>
            {/* Kutusuz bölüm: özet şeridi, filtre satırı ve tablo doğrudan sayfa zemininde.
                Sekme adı zaten "Temettüler" olduğu için görünür bölüm başlığı yok; başlık yalnızca ekran okuyucuya. */}
            <section aria-labelledby="temettu-baslik" className="flex flex-col gap-4 min-w-0">
                <h2 id="temettu-baslik" className="sr-only">Temettüler</h2>
                {deleteSuccessMsg && (
                    <p role="status" className="flex items-center gap-2 text-sm text-profit">
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                        <span>{deleteSuccessMsg}</span>
                    </p>
                )}

                <DividendSummaryCards metrics={metrics} fmt={fmt} />

                {/* Seyrek gereken açıklama kapalı durur */}
                <Disclosure summary="Nakit temettü nasıl kaydedilir?">
                    <p className="max-w-3xl text-sm text-fg-muted leading-relaxed">
                        Nakit temettüler, stopaj kesildikten sonra yatırım hesabınıza yatırılır. Aracı kurumunuzda veya bankanızda gördüğünüz net tutarı kaydedebilirsiniz. Brüt tutar ve stopaj, kayıtta girdiğiniz stopaj oranına göre hesaplanır.
                    </p>
                </Disclosure>

                <DividendFilterBar
                    searchQuery={searchQuery}
                    onSearchChange={value => {
                        setSearchQuery(value);
                        setCurrentPage(1);
                    }}
                    selectedYear={selectedYear}
                    onYearChange={year => {
                        setSelectedYear(year);
                        setCurrentPage(1);
                    }}
                    availableYears={availableYears}
                    actions={
                        <>
                            <IconButton
                                icon={<RefreshCw className={cn(refreshing && 'animate-spin')} />}
                                label="Temettüleri yenile"
                                size="sm"
                                onClick={() => loadDividends(true)}
                                disabled={refreshing}
                            />
                            <Button variant="secondary" size="sm" leftIcon={<Plus />} onClick={() => setIsAddModalOpen(true)}>
                                Temettü ekle
                            </Button>
                        </>
                    }
                />

                {loading ? (
                    <div role="status" className="flex flex-col border-y border-border divide-y divide-border">
                        <span className="sr-only">Temettü geçmişi yükleniyor...</span>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center gap-4 h-12">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-20 ml-auto" />
                                <Skeleton className="hidden sm:block h-4 w-24" />
                            </div>
                        ))}
                    </div>
                ) : filteredRows.length === 0 ? (
                    // "Temettü ekle" düğmesi hemen üstteki filtre satırında; boş durumda ikinci bir düğme yok
                    <EmptyState
                        icon={<Coins />}
                        title={hasActiveFilters ? 'Filtreye uygun temettü bulunamadı' : 'Henüz kayıtlı temettünüz yok'}
                        description={
                            hasActiveFilters
                                ? 'Arama kriterlerinizi değiştirerek veya filtreleri temizleyerek tekrar deneyebilirsiniz.'
                                : 'Hisselerinizden aldığınız nakit temettüleri kaydederek net getiri ve nakit girişlerinizi takip edin.'
                        }
                    />
                ) : (
                    <div className="flex flex-col">
                        <DividendList
                            rows={paginatedRows}
                            fmt={fmt}
                            onEdit={setEditingDividend}
                            onDelete={setDeletingDividend}
                        />

                        {totalPages > 1 && (
                            <ListPagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalCount={filteredRows.length}
                                pageSize={PAGE_SIZE}
                                unitLabel="kayıttan"
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                )}
            </section>

            {/* Temettü ekleme / düzenleme */}
            <AddDividendModal
                isOpen={isAddModalOpen || !!editingDividend}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingDividend(null);
                }}
                onSuccess={async () => {
                    await loadDividends();
                    onRefreshHoldings();
                }}
                holdings={holdings}
                initialDividend={editingDividend}
            />

            {deletingDividend && (
                <DeleteDividendModal
                    symbol={deletingDividend.symbol}
                    netAmount={deletingDividend.net}
                    fmt={fmt}
                    submitting={deleteSubmitting}
                    error={deleteError}
                    onCancel={() => {
                        setDeletingDividend(null);
                        setDeleteError(null);
                    }}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </>
    );
}
