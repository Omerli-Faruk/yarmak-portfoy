'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NormalizedTransaction, Transaction } from '@/types';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { normalizeTransaction } from '@/lib/normalize';
import IconButton from '@/components/ui/IconButton';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { RefreshCw } from 'lucide-react';
import TxSummaryCards, { TxMetrics } from './transactions/TxSummaryCards';
import TxFilterBar, { TxTypeFilter } from './transactions/TxFilterBar';
import TxTable from './transactions/TxTable';
import DeleteTransactionModal from './transactions/DeleteTransactionModal';
import EditTransactionModal from './transactions/EditTransactionModal';

interface TransactionHistoryTabProps {
    currency: 'TRY' | 'USD';
    // Kur yoksa (null ya da 0) tutarlar TL gösterilir
    usdRate: number | null;
    onRefreshHoldings: () => void;
}

export default function TransactionHistoryTab({
    currency,
    usdRate,
    onRefreshHoldings,
}: TransactionHistoryTabProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filtreler ve sayfa
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TxTypeFilter>('ALL');
    const [assetTypeFilter, setAssetTypeFilter] = useState<string>('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Silme onayı
    const [deletingTx, setDeletingTx] = useState<NormalizedTransaction | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Düzenlenen işlem
    const [editingTx, setEditingTx] = useState<NormalizedTransaction | null>(null);

    const loadTransactions = useCallback(async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            const res = await api.get<Transaction[]>('/transactions?limit=1000');
            if (res.data && Array.isArray(res.data)) {
                setTransactions(res.data);
            }
        } catch (err) {
            console.error('İşlemler yüklenemedi:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadTransactions();
    }, [loadTransactions]);

    // Filtre değişince ilk sayfaya dönülür
    const changeSearch = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };
    const changeTypeFilter = (value: TxTypeFilter) => {
        setTypeFilter(value);
        setCurrentPage(1);
    };
    const changeAssetTypeFilter = (value: string) => {
        setAssetTypeFilter(value);
        setCurrentPage(1);
    };

    const handleDeleteTransaction = async () => {
        if (!deletingTx) return;
        const txId = deletingTx.id;
        if (!txId) return;
        setDeleteSubmitting(true);
        setDeleteError(null);
        try {
            await api.delete(`/transactions/${txId}`);
            setTransactions(prev => prev.filter(t => (t.ID ?? t.id) !== txId));
            setDeletingTx(null);
            // Lot ve maliyetler yeniden hesaplansın diye varlıklar tekrar yüklenir
            onRefreshHoldings();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string; message?: string } } };
            const msg = error.response?.data?.error || error.response?.data?.message || 'İşlem silinemedi. Lütfen tekrar deneyin.';
            setDeleteError(msg);
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const handleTxSaved = (txId: number, patch: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => ((t.ID ?? t.id) === txId ? { ...t, ...patch } : t)));
        setEditingTx(null);
        onRefreshHoldings();
    };

    const fmt = (val: number, showPlus = false) => formatCurrency(val, currency, usdRate, showPlus);

    const rows = useMemo(() => transactions.map(normalizeTransaction), [transactions]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return rows.filter((tx) => {
            if (q && !tx.symbol.toLowerCase().includes(q) && !tx.assetName.toLowerCase().includes(q)) {
                return false;
            }
            if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
                return false;
            }
            if (assetTypeFilter !== 'ALL' && tx.assetType !== assetTypeFilter) {
                return false;
            }
            return true;
        });
    }, [rows, searchQuery, typeFilter, assetTypeFilter]);

    // Özet şeridi filtreden bağımsız olarak tüm işlemlerden hesaplanır
    const metrics = useMemo<TxMetrics>(() => {
        let buyCount = 0;
        let sellCount = 0;
        let totalBuyVolume = 0;
        let totalSellVolume = 0;
        let totalRealizedPnL = 0;
        let totalCommission = 0;

        rows.forEach((tx) => {
            const volume = tx.amount * tx.price;
            totalCommission += tx.commission;

            if (tx.type === 'BUY') {
                buyCount++;
                totalBuyVolume += volume;
            } else if (tx.type === 'SELL') {
                sellCount++;
                totalSellVolume += volume;
                totalRealizedPnL += tx.realizedPnl;
            }
        });

        return {
            totalCount: rows.length,
            buyCount,
            sellCount,
            totalBuyVolume,
            totalSellVolume,
            totalRealizedPnL,
            totalCommission,
        };
    }, [rows]);

    // Filtre satırının sonundaki yenileme. Yeni işlem eklemek için sayfa başlığındaki "İşlem ekle" kullanılır.
    const refreshButton = (
        <IconButton
            icon={<RefreshCw className={cn(refreshing && 'animate-spin')} />}
            label="İşlemleri yenile"
            size="sm"
            onClick={() => loadTransactions(true)}
            disabled={refreshing || loading}
        />
    );

    // Sekme adı zaten "İşlem geçmişi" olduğu için görünür bölüm başlığı yok; başlık yalnızca ekran okuyucuya
    if (loading) {
        return (
            <section aria-labelledby="islem-gecmisi-baslik" className="flex flex-col gap-4 min-w-0">
                <h2 id="islem-gecmisi-baslik" className="sr-only">İşlem geçmişi</h2>
                <div role="status" className="flex flex-col gap-4">
                    <span className="sr-only">İşlem geçmişiniz yükleniyor...</span>
                    {/* Özet şeridi */}
                    <div className="flex flex-wrap border-y border-border">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col gap-1.5 basis-1/2 sm:basis-0 sm:grow py-3.5 pr-4">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-5 w-28" />
                            </div>
                        ))}
                    </div>
                    {/* Filtre satırı */}
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-11 sm:h-10 flex-1 sm:flex-none sm:w-64" />
                        <Skeleton className="hidden sm:block h-10 w-48" />
                    </div>
                    <div className="flex flex-col border-y border-border divide-y divide-border">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4 h-12">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-20 ml-auto" />
                                <Skeleton className="hidden sm:block h-4 w-24" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <>
            {/* Kutusuz bölüm: özet şeridi, filtre satırı ve tablo doğrudan sayfa zemininde */}
            <section aria-labelledby="islem-gecmisi-baslik" className="flex flex-col gap-4 min-w-0">
                <h2 id="islem-gecmisi-baslik" className="sr-only">İşlem geçmişi</h2>
                <TxSummaryCards metrics={metrics} fmt={fmt} />

                <TxFilterBar
                    searchQuery={searchQuery}
                    onSearchChange={changeSearch}
                    typeFilter={typeFilter}
                    onTypeFilterChange={changeTypeFilter}
                    assetTypeFilter={assetTypeFilter}
                    onAssetTypeFilterChange={changeAssetTypeFilter}
                    actions={refreshButton}
                />

                <TxTable
                    rows={filteredRows}
                    hasActiveFilters={!!searchQuery || typeFilter !== 'ALL' || assetTypeFilter !== 'ALL'}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    fmt={fmt}
                    onEdit={setEditingTx}
                    onDelete={setDeletingTx}
                />
            </section>

            {deletingTx && (
                <DeleteTransactionModal
                    tx={deletingTx}
                    fmt={fmt}
                    submitting={deleteSubmitting}
                    error={deleteError}
                    onCancel={() => {
                        setDeletingTx(null);
                        setDeleteError(null);
                    }}
                    onConfirm={handleDeleteTransaction}
                />
            )}

            {editingTx && (
                <EditTransactionModal
                    key={editingTx.id}
                    tx={editingTx}
                    onClose={() => setEditingTx(null)}
                    onSaved={handleTxSaved}
                />
            )}
        </>
    );
}
