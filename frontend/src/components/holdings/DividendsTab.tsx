'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dividend, UserHolding } from '@/types';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { normalizeDividend } from '@/lib/normalize';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddDividendModal from './AddDividendModal';
import DividendSummaryCards, { DividendMetrics } from './dividends/DividendSummaryCards';
import DividendFilterBar from './dividends/DividendFilterBar';
import DividendList, { DividendRow } from './dividends/DividendList';
import DeleteDividendModal from './dividends/DeleteDividendModal';
import {
    Coins,
    Plus,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Info,
    CheckCircle2,
} from 'lucide-react';

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
        <div className="space-y-6">
            {/* Başlık ve eylemler */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
                        <Coins className="w-5 h-5 text-slate-400" />
                        <span>Temettü Gelirleri</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Hisselerinizin ödediği nakit temettülerin ve portföyünüze eklenen nakit getirilerin takibi
                    </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={() => loadDividends(true)}
                        disabled={refreshing}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700/60 transition cursor-pointer"
                        title="Yenile"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-400' : ''}`} />
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A9FD3] hover:bg-[#0C6991] active:scale-[0.98] text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-md shadow-[#1A9FD3]/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Temettü Ekle</span>
                    </button>
                </div>
            </div>

            {deleteSuccessMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{deleteSuccessMsg}</span>
                </div>
            )}

            <DividendSummaryCards metrics={metrics} fmt={fmt} />

            {/* Bilgilendirme */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Nakit Temettü Bilgilendirmesi</p>
                    <p className="text-slate-400 leading-relaxed">
                        Nakit temettüler, stopaj kesildikten sonra yatırım hesabınıza yatırılır. Aracı kurumunuzda veya bankanızda gördüğünüz net tutarı kaydedebilirsiniz. Brüt tutar ve stopaj, kayıtta girdiğiniz stopaj oranına göre hesaplanır.
                    </p>
                </div>
            </div>

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
            />

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner />
                    <span className="text-xs sm:text-sm text-slate-400 font-medium">Temettü geçmişi yükleniyor...</span>
                </div>
            ) : filteredRows.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
                    <div className="p-3.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700/60 mb-3">
                        <Coins className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">
                        {hasActiveFilters
                            ? 'Filtreye uygun temettü bulunamadı'
                            : 'Henüz kayıtlı temettünüz yok'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {hasActiveFilters
                            ? 'Arama kriterlerinizi değiştirerek veya filtreleri temizleyerek tekrar deneyebilirsiniz.'
                            : 'Hisselerinizden aldığınız nakit temettüleri kaydederek net getiri ve nakit girişlerinizi takip edin.'}
                    </p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-md shadow-[#1A9FD3]/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>İlk Temettüyü Ekle</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <DividendList
                        rows={paginatedRows}
                        fmt={fmt}
                        onEdit={setEditingDividend}
                        onDelete={setDeletingDividend}
                    />

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-slate-400">
                                Toplam <strong className="text-white">{filteredRows.length}</strong> kayıttan{' '}
                                <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{' '}
                                <strong className="text-white">
                                    {Math.min(currentPage * PAGE_SIZE, filteredRows.length)}
                                </strong>{' '}
                                arası gösteriliyor
                            </span>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 rounded-lg text-slate-300 transition cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-slate-300 px-2 font-mono">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 rounded-lg text-slate-300 transition cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
        </div>
    );
}
