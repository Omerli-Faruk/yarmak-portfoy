'use client';

import React, { useMemo } from 'react';
import { NormalizedTransaction } from '@/types';
import { ASSET_TYPE_LABELS, formatDate } from '@/lib/formatters';
import {
    Clock,
    Plus,
    Calendar,
    ArrowDownRight,
    ArrowUpRight,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

// Tabloda bir sayfada gösterilen işlem sayısı
const ITEMS_PER_PAGE = 25;

interface TxTableProps {
    rows: NormalizedTransaction[];
    hasActiveFilters: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    fmt: (value: number, showPlus?: boolean) => string;
    onAddTx: () => void;
    onEdit: (tx: NormalizedTransaction) => void;
    onDelete: (tx: NormalizedTransaction) => void;
}

function assetTypeBadgeClass(assetType: string): string {
    if (assetType === 'FON') return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    if (assetType === 'ALTIN') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (assetType === 'DOVIZ') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-primary/10 text-primary border-primary/20';
}

export default function TxTable({
    rows,
    hasActiveFilters,
    currentPage,
    onPageChange,
    fmt,
    onAddTx,
    onEdit,
    onDelete,
}: TxTableProps) {
    const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));

    const pageRows = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return rows.slice(start, start + ITEMS_PER_PAGE);
    }, [rows, currentPage]);

    if (rows.length === 0) {
        return (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm">
                <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
                    <div className="size-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                        <Clock className="size-7" />
                    </div>
                    <h3 className="text-base font-bold text-white">İşlem Bulunamadı</h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                        {hasActiveFilters
                            ? 'Seçilen filtrelere uygun işlem geçmişi bulunamadı. Filtreleri temizlemeyi deneyin.'
                            : 'Henüz hiç alım veya satım işlemi kaydetmediniz. İlk işleminizi ekleyerek portföyünüzü oluşturun.'}
                    </p>
                    <button
                        onClick={onAddTx}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm cursor-pointer"
                    >
                        <Plus className="size-3.5" />
                        <span>İlk İşlemi Ekle</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm">
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
                        {pageRows.map((tx, idx) => {
                            const total = tx.amount * tx.price;
                            const isBuy = tx.type === 'BUY';

                            return (
                                <tr
                                    key={tx.id || idx}
                                    className="hover:bg-slate-800/40 transition group"
                                >
                                    {/* Tarih */}
                                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="size-3.5 text-slate-500" />
                                            <span>{formatDate(tx.date)}</span>
                                        </div>
                                    </td>

                                    {/* Varlık */}
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${assetTypeBadgeClass(tx.assetType)}`}>
                                                {ASSET_TYPE_LABELS[tx.assetType] ?? tx.assetType}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white font-mono group-hover:text-primary transition">
                                                    {tx.symbol}
                                                </span>
                                                <span className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-xs">
                                                    {tx.assetName}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Alış / satış */}
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
                                        {tx.amount.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                                    </td>

                                    {/* Birim fiyat */}
                                    <td className="py-3.5 px-4 text-right font-mono text-slate-200 whitespace-nowrap">
                                        {fmt(tx.price)}
                                    </td>

                                    {/* Toplam tutar */}
                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                                        {fmt(total)}
                                    </td>

                                    {/* Gerçekleşen kâr/zarar yalnızca satışlarda gösterilir */}
                                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                                        {!isBuy && tx.realizedPnl !== 0 ? (
                                            <span className={`font-bold ${tx.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {fmt(tx.realizedPnl, true)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-600">—</span>
                                        )}
                                    </td>

                                    {/* Komisyon */}
                                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                                        {fmt(tx.commission)}
                                    </td>

                                    {/* Düzenle / sil */}
                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => onEdit(tx)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                                                title="İşlemi Düzenle"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                                onClick={() => onDelete(tx)}
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

            {rows.length > ITEMS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/30 text-xs">
                    <span className="text-slate-400 font-medium">
                        Toplam <span className="text-white font-bold">{rows.length}</span> işlemden{' '}
                        <span className="text-white font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> -{' '}
                        <span className="text-white font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, rows.length)}</span> arası gösteriliyor
                    </span>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                        >
                            <span>Sonraki</span>
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
