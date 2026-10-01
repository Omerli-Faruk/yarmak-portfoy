'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dividend, UserHolding } from '@/types';
import api from '@/lib/api';
import { formatCurrency, formatDateOnly } from '@/lib/formatters';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddDividendModal from './AddDividendModal';
import {
    Coins,
    Search,
    Trash2,
    Plus,
    RefreshCw,
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Info,
    Building2,
    Wallet,
    Receipt,
    X,
    CheckCircle2,
    Pencil
} from 'lucide-react';

interface DividendsTabProps {
    currency: 'TRY' | 'USD';
    usdRate: number;
    holdings: UserHolding[];
    onRefreshHoldings: () => void;
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

    // Filtreleme State'leri
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('ALL');

    // Sayfalama (Pagination)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 12;

    // Silme Modalı State
    const [deletingDividend, setDeletingDividend] = useState<Dividend | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

    // Temettüleri API'den Çek
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

    // Silme İşlemini Gerçekleştir
    const handleConfirmDelete = async () => {
        if (!deletingDividend) return;
        const divId = deletingDividend.ID || deletingDividend.id;
        if (!divId) return;

        setDeleteSubmitting(true);
        setDeleteError(null);
        try {
            await api.delete(`/dividends/${divId}`);
            // Optimistic update: son temettü silinse dahi anında arayüzden kaldır
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

    // Mevcut Yılları Listele
    const availableYears = useMemo(() => {
        const yearsSet = new Set<string>();
        dividends.forEach(d => {
            const dateStr = d.PaymentDate || d.payment_date || d.CreatedAt || d.created_at;
            if (dateStr) {
                const year = new Date(dateStr).getFullYear();
                if (!isNaN(year)) yearsSet.add(String(year));
            }
        });
        return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
    }, [dividends]);

    // Filtrelenmiş Temettüler
    const filteredDividends = useMemo(() => {
        return dividends.filter(d => {
            const sym = (d.Symbol || d.symbol || '').toUpperCase();
            const name = (d.AssetName || d.asset_name || '').toLowerCase();
            const q = searchQuery.trim().toLowerCase();

            // Arama sorgusu eşleşmesi
            if (q && !sym.toLowerCase().includes(q) && !name.includes(q)) {
                return false;
            }

            // Yıl filtresi
            if (selectedYear !== 'ALL') {
                const dateStr = d.PaymentDate || d.payment_date || d.CreatedAt || d.created_at;
                if (dateStr) {
                    const year = new Date(dateStr).getFullYear();
                    if (String(year) !== selectedYear) return false;
                }
            }

            return true;
        });
    }, [dividends, searchQuery, selectedYear]);

    // İstatistik ve Metrikler
    const metrics = useMemo(() => {
        let totalGross = 0;
        let totalTax = 0;
        let totalNet = 0;
        const uniqueSymbols = new Set<string>();

        filteredDividends.forEach(d => {
            const gross = parseFloat(d.GrossAmount || d.gross_amount || d.Amount || d.amount || '0') || 0;
            const tax = parseFloat(d.TaxAmount || d.tax_amount || '0') || 0;
            const net = parseFloat(d.NetAmount || d.net_amount || (gross - tax).toString()) || 0;

            totalGross += gross;
            totalTax += tax;
            totalNet += net;

            const sym = d.Symbol || d.symbol;
            if (sym) uniqueSymbols.add(sym);
        });

        const effectiveTaxRate = totalGross > 0 ? (totalTax / totalGross) * 100 : 0;

        return {
            totalGross,
            totalTax,
            totalNet,
            uniqueAssetsCount: uniqueSymbols.size,
            effectiveTaxRate,
            totalCount: filteredDividends.length,
        };
    }, [filteredDividends]);

    // Sayfalama Hesaplamaları
    const totalPages = Math.ceil(filteredDividends.length / pageSize) || 1;
    const paginatedDividends = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDividends.slice(start, start + pageSize);
    }, [filteredDividends, currentPage, pageSize]);

    // Para formatı yardımcısı
    const fmt = (val: number, showPlus = false) => formatCurrency(val, currency, usdRate, showPlus);

    return (
        <div className="space-y-6">
            {/* BAŞLIK & EYLEM ALANI */}
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

            {/* BAŞARI MESAJI */}
            {deleteSuccessMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{deleteSuccessMsg}</span>
                </div>
            )}

            {/* 4 ÖZET KART METRİKLERİ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Hesaba Geçen Net Temettü (Başrol) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Net Nakit Temettü</span>
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                        {fmt(metrics.totalNet)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>Yatırım hesabınıza yatan net nakit</span>
                    </div>
                </div>

                {/* 2. Toplam Brüt / Tahakkuk */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Toplam Brüt Tutar</span>
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                            <Receipt className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                        {fmt(metrics.totalGross)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>Brüt tahakkuk eden toplam tutar</span>
                    </div>
                </div>

                {/* 3. Ödeme Yapan Şirketler */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Ödeme Yapan Şirketler</span>
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                        {metrics.uniqueAssetsCount} <span className="text-sm font-normal text-slate-400">Şirket</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>Portföyünüzden temettü verenler</span>
                    </div>
                </div>

                {/* 4. Toplam Ödeme Kaydı */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Ödeme Adedi</span>
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                        {metrics.totalCount} <span className="text-sm font-normal text-slate-400">İşlem</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>Kayıtlı toplam temettü hareketi</span>
                    </div>
                </div>
            </div>

            {/* BİLGİLENDİRME BANDI */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Nakit Temettü Bilgilendirmesi</p>
                    <p className="text-slate-400 leading-relaxed">
                        Borsa İstanbul pay senedi temettüleri hesabınıza doğrudan nakit bakiye olarak yansır. Midas veya bankanızda gördüğünüz net tutarları doğrudan kaydedebilirsiniz.
                    </p>
                </div>
            </div>

            {/* FİLTRE & ARAMA ÇUBUĞU */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Arama */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Hisse kodu veya şirket ara..."
                        value={searchQuery}
                        onChange={e => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full bg-slate-800 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setCurrentPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Yıl Seçici */}
                <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
                    <span className="text-xs font-bold text-slate-400 mr-1.5 shrink-0 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Yıl:
                    </span>
                    <button
                        onClick={() => {
                            setSelectedYear('ALL');
                            setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                            selectedYear === 'ALL'
                                ? 'bg-[#1A9FD3] text-white shadow-sm shadow-[#1A9FD3]/20'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
                        }`}
                    >
                        Tümü
                    </button>
                    {availableYears.map(yr => (
                        <button
                            key={yr}
                            onClick={() => {
                                setSelectedYear(yr);
                                setCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                                selectedYear === yr
                                ? 'bg-[#1A9FD3] text-white shadow-sm shadow-[#1A9FD3]/20'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
                            }`}
                        >
                            {yr}
                        </button>
                    ))}
                </div>
            </div>

            {/* TABLO & LİSTE ALANI */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner />
                    <span className="text-xs sm:text-sm text-slate-400 font-medium">Temettü geçmişi yükleniyor...</span>
                </div>
            ) : filteredDividends.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
                    <div className="p-3.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700/60 mb-3">
                        <Coins className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">
                        {searchQuery || selectedYear !== 'ALL'
                            ? 'Filtreye Uygun Temettü Bulunamadı'
                            : 'Henüz Kayıtlı Temettü Geliriniz Yok'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {searchQuery || selectedYear !== 'ALL'
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
                    {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ */}
                    <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3 px-4">Ödeme Tarihi</th>
                                    <th className="py-3 px-4">Varlık / Şirket</th>
                                    <th className="py-3 px-4 text-right">Brüt Tutar</th>
                                    <th className="py-3 px-4 text-right">Stopaj Kesintisi</th>
                                    <th className="py-3 px-4 text-right">Hesaba Yatan Net</th>
                                    <th className="py-3 px-4 text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                                {paginatedDividends.map((div) => {
                                    const gross = parseFloat(div.GrossAmount || div.gross_amount || div.Amount || div.amount || '0') || 0;
                                    const tax = parseFloat(div.TaxAmount || div.tax_amount || '0') || 0;
                                    const net = parseFloat(div.NetAmount || div.net_amount || (gross - tax).toString()) || 0;
                                    const dateStr = div.PaymentDate || div.payment_date || div.CreatedAt || div.created_at;
                                    const sym = div.Symbol || div.symbol || '—';
                                    const name = div.AssetName || div.asset_name || '';
                                    const taxRate = gross > 0 ? Math.round((tax / gross) * 100) : 10;

                                    return (
                                        <tr key={div.ID || div.id} className="hover:bg-slate-800/30 transition">
                                            <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                                                {formatDateOnly(dateStr)}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span>{sym}</span>
                                                    {name && (
                                                        <span className="text-[11px] font-normal text-slate-400 truncate max-w-[180px]">
                                                            {name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                                                {fmt(gross)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <span className="text-amber-400 font-mono tabular-nums">
                                                        -{fmt(tax)}
                                                    </span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        %{taxRate}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                                                +{fmt(net)}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setEditingDividend(div)}
                                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                                        title="Temettüyü Düzenle"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingDividend(div)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                                        title="Kaydı Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBİL KART GÖRÜNÜMÜ */}
                    <div className="md:hidden space-y-3">
                        {paginatedDividends.map((div) => {
                            const gross = parseFloat(div.GrossAmount || div.gross_amount || div.Amount || div.amount || '0') || 0;
                            const tax = parseFloat(div.TaxAmount || div.tax_amount || '0') || 0;
                            const net = parseFloat(div.NetAmount || div.net_amount || (gross - tax).toString()) || 0;
                            const dateStr = div.PaymentDate || div.payment_date || div.CreatedAt || div.created_at;
                            const sym = div.Symbol || div.symbol || '—';
                            const name = div.AssetName || div.asset_name || '';
                            const taxRate = gross > 0 ? Math.round((tax / gross) * 100) : 10;

                            return (
                                <div
                                    key={div.ID || div.id}
                                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-base">{sym}</span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {formatDateOnly(dateStr)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingDividend(div)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                                title="Düzenle"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingDividend(div)}
                                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                                title="Sil"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {name && (
                                        <p className="text-xs text-slate-400 truncate">{name}</p>
                                    )}

                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase block font-medium">Brüt</span>
                                            <span className="font-mono text-slate-300 font-semibold">{fmt(gross)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase block font-medium">
                                                Stopaj (%{taxRate})
                                            </span>
                                            <span className="font-mono text-amber-400 font-semibold">-{fmt(tax)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-emerald-500 uppercase block font-medium">Net Yatan</span>
                                            <span className="font-mono text-emerald-400 font-bold">+{fmt(net)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* SAYFALAMA (PAGINATION) */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-slate-400">
                                Toplam <strong className="text-white">{filteredDividends.length}</strong> kayıttan{' '}
                                <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> -{' '}
                                <strong className="text-white">
                                    {Math.min(currentPage * pageSize, filteredDividends.length)}
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

            {/* TEMETTÜ EKLEME / DÜZENLEME MODALI */}
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

            {/* SİLME ONAY MODALI */}
            {deletingDividend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2 text-rose-400 font-bold">
                                <AlertTriangle className="w-5 h-5" />
                                <span>Temettü Kaydını Sil</span>
                            </div>
                            <button
                                onClick={() => setDeletingDividend(null)}
                                className="text-slate-400 hover:text-white transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            <strong className="text-white font-mono">{deletingDividend.Symbol || deletingDividend.symbol}</strong> hissesine ait{' '}
                            <strong className="text-emerald-400 font-mono">
                                {fmt(parseFloat(deletingDividend.NetAmount || deletingDividend.net_amount || deletingDividend.Amount || deletingDividend.amount || '0'))}
                            </strong> tutarındaki temettü kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                        </p>

                        {deleteError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                                {deleteError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingDividend(null)}
                                disabled={deleteSubmitting}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleteSubmitting}
                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-md shadow-rose-500/20"
                            >
                                {deleteSubmitting ? 'Siliniyor...' : 'Evet, Sil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
