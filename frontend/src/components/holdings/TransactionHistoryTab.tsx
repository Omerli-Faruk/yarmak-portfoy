'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction } from '@/types';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
    Clock,
    TrendingUp,
    TrendingDown,
    Search,
    Trash2,
    Filter,
    Plus,
    RefreshCw,
    AlertTriangle,
    Receipt,
    Calendar,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle2,
    X,
    Pencil,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface TransactionHistoryTabProps {
    currency: 'TRY' | 'USD';
    usdRate: number;
    onRefreshHoldings: () => void;
    onOpenAddTxModal: () => void;
    refreshTrigger?: number;
}

export default function TransactionHistoryTab({
    currency,
    usdRate,
    onRefreshHoldings,
    onOpenAddTxModal,
    refreshTrigger = 0,
}: TransactionHistoryTabProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filtreler
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
    const [assetTypeFilter, setAssetTypeFilter] = useState<string>('ALL');

    // Silme Modalı State
    const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Düzenleme Modalı State
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [editType, setEditType] = useState<'BUY' | 'SELL'>('BUY');
    const [editAmount, setEditAmount] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editCommission, setEditCommission] = useState('0');
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // İşlemleri API'den Çek
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
        loadTransactions();
    }, [loadTransactions, refreshTrigger]);

    // İşlem Silme İşlemi
    const handleDeleteTransaction = async () => {
        if (!deletingTx) return;
        const txId = deletingTx.ID ?? deletingTx.id;
        if (!txId) return;
        setDeleteSubmitting(true);
        setDeleteError(null);
        try {
            await api.delete(`/transactions/${txId}`);
            // Listeyi yerel güncelle
            setTransactions(prev => prev.filter(t => (t.ID ?? t.id) !== txId));
            setDeletingTx(null);
            // Varlıkları ve maliyetleri yeniden hesaplamak için üst bileşeni tetikle
            onRefreshHoldings();
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'İşlem silinemedi. Lütfen tekrar deneyin.';
            setDeleteError(msg);
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // İşlem Düzenleme Modalını Aç
    const handleOpenEditModal = (tx: Transaction) => {
        setEditingTx(tx);
        setEditType((tx.Type || tx.type || 'BUY').toUpperCase() as 'BUY' | 'SELL');
        setEditAmount(tx.Amount || tx.amount || '');
        setEditPrice(tx.Price || tx.price || '');
        const d = tx.TransactionDate || tx.transaction_date || tx.CreatedAt || tx.created_at || '';
        if (d) {
            try {
                const dateObj = new Date(d);
                // Türkiye saatine veya yerel saate uygun format (YYYY-MM-DDTHH:mm)
                const pad = (n: number) => String(n).padStart(2, '0');
                const localIso = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                setEditDate(localIso);
            } catch {
                setEditDate(new Date().toISOString().slice(0, 16));
            }
        } else {
            setEditDate(new Date().toISOString().slice(0, 16));
        }
        setEditCommission(tx.Commission || tx.commission || '0');
        setEditError(null);
    };

    // Düzenlemeyi Kaydet
    const handleSaveEditTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTx) return;
        const txId = editingTx.ID ?? editingTx.id;
        if (!txId) return;

        const amountNum = parseFloat(editAmount);
        const priceNum = parseFloat(editPrice);
        const commNum = parseFloat(editCommission) || 0;

        if (isNaN(amountNum) || amountNum <= 0) {
            setEditError('Lütfen geçerli bir işlem adedi girin.');
            return;
        }
        if (isNaN(priceNum) || priceNum <= 0) {
            setEditError('Lütfen geçerli bir birim fiyat girin.');
            return;
        }

        setEditSubmitting(true);
        setEditError(null);

        try {
            const payload = {
                type: editType,
                amount: amountNum,
                price: priceNum,
                transaction_date: new Date(editDate).toISOString(),
                commission: commNum,
            };

            const res = await api.put<Transaction>(`/transactions/${txId}`, payload);

            // Listeyi yerel olarak güncelle
            setTransactions(prev => prev.map(t => {
                const id = t.ID ?? t.id;
                if (id === txId) {
                    return {
                        ...t,
                        ...res.data,
                        Type: editType,
                        type: editType,
                        Amount: String(amountNum),
                        amount: String(amountNum),
                        Price: String(priceNum),
                        price: String(priceNum),
                        TransactionDate: new Date(editDate).toISOString(),
                        transaction_date: new Date(editDate).toISOString(),
                        Commission: String(commNum),
                        commission: String(commNum),
                    };
                }
                return t;
            }));

            setEditingTx(null);
            // Portföy varlıklarını ve maliyetlerini yeniden hesaplamak için üst bileşeni tetikle
            onRefreshHoldings();
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'İşlem güncellenemedi. Lütfen değerleri kontrol edin.';
            setEditError(msg);
        } finally {
            setEditSubmitting(false);
        }
    };

    // Para birimine göre formatlama
    const fmt = (val: number, showPlus = false) => formatCurrency(val, currency, usdRate, showPlus);

    // Filtrelenmiş İşlemler
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const sym = (tx.Symbol || tx.symbol || '').toLowerCase();
            const name = (tx.AssetName || tx.asset_name || '').toLowerCase();
            const type = (tx.Type || tx.type || 'BUY').toUpperCase();
            const assetType = (tx.AssetType || tx.asset_type || 'HISSE').toUpperCase();

            // 1. Arama Filtresi
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                if (!sym.includes(q) && !name.includes(q)) return false;
            }

            // 2. İşlem Tipi Filtresi (BUY/SELL)
            if (typeFilter !== 'ALL' && type !== typeFilter) {
                return false;
            }

            // 3. Varlık Türü Filtresi
            if (assetTypeFilter !== 'ALL' && assetType !== assetTypeFilter) {
                return false;
            }

            return true;
        });
    }, [transactions, searchQuery, typeFilter, assetTypeFilter]);

    // Sayfalama (Pagination) — DOM yükünü ve bellek tüketimini minimize eder
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    // Arama veya filtreler değiştiğinde ilk sayfaya dön
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, typeFilter, assetTypeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTransactions, currentPage]);

    // Özet Metrik Hesaplamaları
    const metrics = useMemo(() => {
        let buyCount = 0;
        let sellCount = 0;
        let totalBuyVolume = 0;
        let totalSellVolume = 0;
        let totalRealizedPnL = 0;
        let totalCommission = 0;

        transactions.forEach((tx) => {
            const amount = parseFloat(tx.Amount || tx.amount || '0') || 0;
            const price = parseFloat(tx.Price || tx.price || '0') || 0;
            const volume = amount * price;
            const comm = parseFloat(tx.Commission || tx.commission || '0') || 0;
            const pnl = parseFloat(tx.RealizedPnl || tx.realized_pnl || '0') || 0;
            const type = (tx.Type || tx.type || 'BUY').toUpperCase();

            totalCommission += comm;

            if (type === 'BUY') {
                buyCount++;
                totalBuyVolume += volume;
            } else if (type === 'SELL') {
                sellCount++;
                totalSellVolume += volume;
                totalRealizedPnL += pnl;
            }
        });

        return {
            totalCount: transactions.length,
            buyCount,
            sellCount,
            totalBuyVolume,
            totalSellVolume,
            totalRealizedPnL,
            totalCommission,
        };
    }, [transactions]);

    if (loading) {
        return (
            <div className="py-16">
                <LoadingSpinner message="İşlem geçmişiniz yükleniyor..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ═══════════════ 1. ÖZET İSTATİSTİK KARTLARI ═══════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Toplam İşlem Sayısı */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <Receipt className="size-4 text-primary" /> Toplam İşlem
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border/50 text-slate-400">
                            Kayıtlar
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="text-xl sm:text-2xl font-black font-mono text-white">
                            {metrics.totalCount}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                            <span className="text-emerald-400 font-semibold">{metrics.buyCount} Alış</span>
                            <span>•</span>
                            <span className="text-rose-400 font-semibold">{metrics.sellCount} Satış</span>
                        </div>
                    </div>
                </div>

                {/* Toplam Alış Hacmi */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <ArrowDownRight className="size-4 text-emerald-400" /> Alış Hacmi
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Giriş
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="text-lg sm:text-xl font-black font-mono text-white">
                            {fmt(metrics.totalBuyVolume)}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                            Toplam portföye yatırılan
                        </div>
                    </div>
                </div>

                {/* Toplam Realize Kâr/Zarar */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <TrendingUp className="size-4 text-primary" /> Gerçekleşen K/Z
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                            metrics.totalRealizedPnL >= 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                            Satışlardan
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className={`text-lg sm:text-xl font-black font-mono ${
                            metrics.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                            {fmt(metrics.totalRealizedPnL, true)}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                            Kapatılan pozisyon kârı
                        </div>
                    </div>
                </div>

                {/* Toplam Komisyon */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <Receipt className="size-4 text-amber-400" /> Komisyon Gideri
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                            Gider
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="text-lg sm:text-xl font-black font-mono text-slate-200">
                            {fmt(metrics.totalCommission)}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                            Ödenen aracı kurum payı
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════ 2. FİLTRELEME & AKSİYON BARI ═══════════════ */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
                
                {/* Arama & Tip Filtreleri */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    {/* Arama Kutusu */}
                    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Sembol veya varlık ara..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>

                    {/* İşlem Tipi Filtresi (Tümü / Alış / Satış) */}
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
                        {(['ALL', 'BUY', 'SELL'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                                    typeFilter === t
                                        ? t === 'BUY'
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : t === 'SELL'
                                            ? 'bg-rose-500 text-white shadow-sm'
                                            : 'bg-primary text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {t === 'ALL' ? 'Tümü' : t === 'BUY' ? 'Alışlar' : 'Satışlar'}
                            </button>
                        ))}
                    </div>

                    {/* Varlık Türü Filtresi */}
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs hidden md:flex">
                        {[
                            { id: 'ALL', label: 'Tüm Türler' },
                            { id: 'HISSE', label: 'Hisse' },
                            { id: 'FON', label: 'Fon' },
                            { id: 'ALTIN', label: 'Altın' },
                            { id: 'DOVIZ', label: 'Döviz' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setAssetTypeFilter(item.id)}
                                className={`px-2 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                                    assetTypeFilter === item.id
                                        ? 'bg-slate-700 text-white font-bold'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sağ Taraf: Yenile & İşlem Ekle */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={() => loadTransactions(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-primary transition cursor-pointer disabled:opacity-50"
                        title="İşlemleri Yenile"
                    >
                        <RefreshCw className={`size-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
                    </button>
                    <button
                        onClick={onOpenAddTxModal}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm shadow-primary/20 cursor-pointer active:scale-95"
                    >
                        <Plus className="size-4 stroke-[2.5]" />
                        <span>Yeni İşlem</span>
                    </button>
                </div>
            </div>

            {/* ═══════════════ 3. İŞLEMLER TABLOSU ═══════════════ */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm">
                {filteredTransactions.length === 0 ? (
                    <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
                        <div className="size-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                            <Clock className="size-7" />
                        </div>
                        <h3 className="text-base font-bold text-white">İşlem Bulunamadı</h3>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            {searchQuery || typeFilter !== 'ALL' || assetTypeFilter !== 'ALL'
                                ? 'Seçilen filtrelere uygun işlem geçmişi bulunamadı. Filtreleri temizlemeyi deneyin.'
                                : 'Henüz hiç alım veya satım işlemi kaydetmediniz. İlk işleminizi ekleyerek portföyünüzü oluşturun.'}
                        </p>
                        <button
                            onClick={onOpenAddTxModal}
                            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm cursor-pointer"
                        >
                            <Plus className="size-3.5" />
                            <span>İlk İşlemi Ekle</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto custom-horizontal-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3 px-4">Tarih</th>
                                    <th className="py-3 px-4">Varlık</th>
                                    <th className="py-3 px-4 text-center">İşlem Türü</th>
                                    <th className="py-3 px-4 text-right">Adet / Lot</th>
                                    <th className="py-3 px-4 text-right">Birim Fiyat</th>
                                    <th className="py-3 px-4 text-right">Toplam Tutar</th>
                                    <th className="py-3 px-4 text-right">Realize K/Z</th>
                                    <th className="py-3 px-4 text-right">Komisyon</th>
                                    <th className="py-3 px-4 text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                                {paginatedTransactions.map((tx, idx) => {
                                    const txId = tx.ID ?? tx.id ?? idx;
                                    const symbol = tx.Symbol || tx.symbol || '';
                                    const assetName = tx.AssetName || tx.asset_name || symbol;
                                    const assetType = (tx.AssetType || tx.asset_type || 'HISSE').toUpperCase();
                                    const type = (tx.Type || tx.type || 'BUY').toUpperCase();
                                    const amount = parseFloat(tx.Amount || tx.amount || '0') || 0;
                                    const price = parseFloat(tx.Price || tx.price || '0') || 0;
                                    const total = amount * price;
                                    const pnl = parseFloat(tx.RealizedPnl || tx.realized_pnl || '0') || 0;
                                    const comm = parseFloat(tx.Commission || tx.commission || '0') || 0;
                                    const isBuy = type === 'BUY';
                                    const txDate = tx.TransactionDate || tx.transaction_date || tx.CreatedAt || tx.created_at || '';

                                    return (
                                        <tr
                                            key={txId}
                                            className="hover:bg-slate-800/40 transition group"
                                        >
                                            {/* Tarih */}
                                            <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="size-3.5 text-slate-500" />
                                                    <span>{formatDate(txDate)}</span>
                                                </div>
                                            </td>

                                            {/* Varlık */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                                        assetType === 'FON'
                                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                            : assetType === 'ALTIN'
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            : assetType === 'DOVIZ'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            : 'bg-primary/10 text-primary border-primary/20'
                                                    }`}>
                                                        {assetType}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white font-mono group-hover:text-primary transition">
                                                            {symbol}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-xs">
                                                            {assetName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Tür (ALIŞ / SATIŞ) */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border ${
                                                    isBuy
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                                }`}>
                                                    {isBuy ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
                                                    {isBuy ? 'ALIŞ' : 'SATIŞ'}
                                                </span>
                                            </td>

                                            {/* Adet */}
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                                                {amount.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                                            </td>

                                            {/* Birim Fiyat */}
                                            <td className="py-3.5 px-4 text-right font-mono text-slate-200 whitespace-nowrap">
                                                {fmt(price)}
                                            </td>

                                            {/* Toplam Tutar */}
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                                                {fmt(total)}
                                            </td>

                                            {/* Realize K/Z */}
                                            <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                                                {!isBuy && pnl !== 0 ? (
                                                    <span className={`font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {fmt(pnl, true)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>

                                            {/* Komisyon */}
                                            <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                                                {comm > 0 ? fmt(comm) : '₺0,00'}
                                            </td>

                                            {/* İşlem Butonları (Düzenleme ve Silme) */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditModal(tx)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                                                        title="İşlemi Düzenle"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingTx(tx)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                                        title="İşlemi Sil"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Sayfalama (Pagination) Kontrolleri */}
                    {filteredTransactions.length > ITEMS_PER_PAGE && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/30 text-xs">
                            <span className="text-slate-400 font-medium">
                                Toplam <span className="text-white font-bold">{filteredTransactions.length}</span> işlemden{' '}
                                <span className="text-white font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> -{' '}
                                <span className="text-white font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}</span> arası gösteriliyor
                            </span>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    <span>Önceki</span>
                                </button>

                                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono font-bold">
                                    {currentPage} / {totalPages}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                                >
                                    <span>Sonraki</span>
                                    <ChevronRight className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* ═══════════════ 4. İŞLEM SİLME ONAY MODALI ═══════════════ */}
            {deletingTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <AlertTriangle className="size-6 text-rose-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">İşlemi Sil</h3>
                                <p className="text-xs text-slate-400">Bu işlem geri alınamaz.</p>
                            </div>
                        </div>

                        <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs font-mono">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Varlık:</span>
                                <span className="font-bold text-white">
                                    {deletingTx.Symbol || deletingTx.symbol} ({deletingTx.AssetName || deletingTx.asset_name || deletingTx.Symbol || deletingTx.symbol})
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">İşlem Türü:</span>
                                <span className={`font-bold ${(deletingTx.Type || deletingTx.type) === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(deletingTx.Type || deletingTx.type) === 'BUY' ? 'ALIŞ' : 'SATIŞ'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Miktar:</span>
                                <span className="text-white">
                                    {(parseFloat(deletingTx.Amount || deletingTx.amount || '0') || 0).toLocaleString('tr-TR')} Adet
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Birim Fiyat:</span>
                                <span className="text-white">
                                    {fmt(parseFloat(deletingTx.Price || deletingTx.price || '0') || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Tarih:</span>
                                <span className="text-white">
                                    {formatDate(deletingTx.TransactionDate || deletingTx.transaction_date || deletingTx.CreatedAt || deletingTx.created_at)}
                                </span>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                <span>{deleteError}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeletingTx(null);
                                    setDeleteError(null);
                                }}
                                disabled={deleteSubmitting}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteTransaction}
                                disabled={deleteSubmitting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {deleteSubmitting ? (
                                    <>
                                        <RefreshCw className="size-3.5 animate-spin" />
                                        <span>Siliniyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="size-3.5" />
                                        <span>İşlemi Kesin Olarak Sil</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ 5. İŞLEM DÜZENLEME MODALI ═══════════════ */}
            {editingTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                        
                        {/* Başlık */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                                    <Pencil className="size-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <span>İşlemi Düzenle</span>
                                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                            {editingTx.Symbol || editingTx.symbol}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 truncate max-w-xs">
                                        {editingTx.AssetName || editingTx.asset_name || editingTx.Symbol || editingTx.symbol}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingTx(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditTransaction} className="space-y-4">
                            {/* İşlem Türü (ALIŞ / SATIŞ) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                    İşlem Türü
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditType('BUY')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                            editType === 'BUY'
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm shadow-emerald-500/10'
                                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                                        }`}
                                    >
                                        <ArrowDownRight className="size-4" />
                                        <span>ALIŞ (BUY)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditType('SELL')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                            editType === 'SELL'
                                                ? 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-sm shadow-rose-500/10'
                                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                                        }`}
                                    >
                                        <ArrowUpRight className="size-4" />
                                        <span>SATIŞ (SELL)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Miktar (Adet) ve Birim Fiyat */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                        Adet / Lot
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={editAmount}
                                        onChange={(e) => setEditAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                        Birim Fiyat ({currency === 'USD' ? '$' : '₺'})
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                                    />
                                </div>
                            </div>

                            {/* Toplam Tutar Canlı Bilgi */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                <span className="text-slate-400">Toplam İşlem Tutarı:</span>
                                <span className="text-sm font-black font-mono text-white">
                                    {fmt((parseFloat(editAmount) || 0) * (parseFloat(editPrice) || 0))}
                                </span>
                            </div>

                            {/* Komisyon ve Tarih */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                        Komisyon (₺)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={editCommission}
                                        onChange={(e) => setEditCommission(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                        İşlem Tarihi & Saati
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-primary transition [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* Hata Mesajı */}
                            {editError && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                    <span>{editError}</span>
                                </div>
                            )}

                            {/* Modal Butonları */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingTx(null)}
                                    disabled={editSubmitting}
                                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSubmitting}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {editSubmitting ? (
                                        <>
                                            <RefreshCw className="size-3.5 animate-spin" />
                                            <span>Güncelleniyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="size-3.5" />
                                            <span>Değişiklikleri Kaydet</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
