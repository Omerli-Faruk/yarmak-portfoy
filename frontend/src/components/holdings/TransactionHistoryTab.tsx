'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NormalizedTransaction, Transaction } from '@/types';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { normalizeTransaction } from '@/lib/normalize';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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
    onOpenAddTxModal: () => void;
}

export default function TransactionHistoryTab({
    currency,
    usdRate,
    onRefreshHoldings,
    onOpenAddTxModal,
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

    // Özet kartlar filtreden bağımsız olarak tüm işlemlerden hesaplanır
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

    if (loading) {
        return (
            <div className="py-16">
                <LoadingSpinner message="İşlem geçmişiniz yükleniyor..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <TxSummaryCards metrics={metrics} fmt={fmt} />

            <TxFilterBar
                searchQuery={searchQuery}
                onSearchChange={changeSearch}
                typeFilter={typeFilter}
                onTypeFilterChange={changeTypeFilter}
                assetTypeFilter={assetTypeFilter}
                onAssetTypeFilterChange={changeAssetTypeFilter}
                refreshing={refreshing}
                onRefresh={() => loadTransactions(true)}
                onAddTx={onOpenAddTxModal}
            />

            <TxTable
                rows={filteredRows}
                hasActiveFilters={!!searchQuery || typeFilter !== 'ALL' || assetTypeFilter !== 'ALL'}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                fmt={fmt}
                onAddTx={onOpenAddTxModal}
                onEdit={setEditingTx}
                onDelete={setDeletingTx}
            />

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
        </div>
    );
}
