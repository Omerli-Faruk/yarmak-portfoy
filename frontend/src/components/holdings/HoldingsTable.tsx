'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    GripVertical,
    ArrowUpRight,
    Tag,
    Plus,
    MinusCircle,
    Trash2,
    ChevronRight,
} from 'lucide-react';
import type { AssetGroup, AssetSummaryMap, Period, UserHolding } from '@/types';
import { getPeriodHeaderLabel } from '@/lib/periodUtils';
import { ASSET_TYPE_LABELS, formatSignedPercent } from '@/lib/formatters';
import { getHoldingRowMetrics } from './holdingRowMetrics';
import GroupBadges from './GroupBadges';

interface HoldingsTableProps {
    items: UserHolding[];
    selectedPeriod: Period;
    assetSummaries: AssetSummaryMap;
    groups: AssetGroup[];
    assetGroups: Record<string, string[]>;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    activeGroupMetrics: {
        isCustomGroup: boolean;
        groupName: string;
    };
    onQuickAddTx: (symbol: string) => void;
    onQuickSellTx: (holding: UserHolding) => void;
    onAssignAsset: (asset: UserHolding) => void;
    onDeleteAsset: (asset: UserHolding) => void;
    onRemoveFromCurrentGroup: (symbol: string) => void;
    onDropAsset: (draggedSymbol: string, targetSymbol: string) => void;
}

export default function HoldingsTable({
    items,
    selectedPeriod,
    assetSummaries,
    groups,
    assetGroups,
    fmt,
    activeGroupMetrics,
    onQuickAddTx,
    onQuickSellTx,
    onAssignAsset,
    onDeleteAsset,
    onRemoveFromCurrentGroup,
    onDropAsset,
}: HoldingsTableProps) {
    const [draggedSymbol, setDraggedSymbol] = useState<string | null>(null);
    const [dragOverSymbol, setDragOverSymbol] = useState<string | null>(null);

    const periodHeaderLabel = getPeriodHeaderLabel(selectedPeriod);

    const resetDrag = () => {
        setDraggedSymbol(null);
        setDragOverSymbol(null);
    };

    const handleDrop = (targetSymbol: string) => {
        if (draggedSymbol && draggedSymbol !== targetSymbol) {
            onDropAsset(draggedSymbol, targetSymbol);
        }
        resetDrag();
    };

    // Masaüstü satırı ve mobil kart aynı sürükle-bırak davranışını kullanır
    const dragHandlers = (symbol: string) => ({
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData('text/plain', symbol);
            e.dataTransfer.effectAllowed = 'move';
            setDraggedSymbol(symbol);
        },
        onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverSymbol !== symbol) setDragOverSymbol(symbol);
        },
        onDragLeave: () => {
            if (dragOverSymbol === symbol) setDragOverSymbol(null);
        },
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            handleDrop(symbol);
        },
        onDragEnd: resetDrag,
    });

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Masaüstü: tablo */}
            <div className="hidden md:block overflow-x-auto custom-horizontal-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                            <th scope="col" className="py-3.5 pl-4 pr-1 text-center w-16">Sıra</th>
                            <th scope="col" className="py-3.5 pl-2 pr-3">Varlık</th>
                            <th scope="col" className="py-3.5 px-3">Tür</th>
                            <th scope="col" className="py-3.5 px-3 text-right">Adet & Maliyet</th>
                            <th scope="col" className="py-3.5 px-3 text-right">Güncel Fiyat</th>
                            <th scope="col" className="py-3.5 px-3 text-right">{periodHeaderLabel}</th>
                            <th scope="col" className="py-3.5 px-3 text-right">Net Kâr / Zarar</th>
                            <th scope="col" className="py-3.5 pl-2 pr-5 text-right w-40">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                        {items.map((h, idx) => {
                            const { pnl, pnlPct, isPos, periodRetVal, periodPnl, isPeriodPos } =
                                getHoldingRowMetrics(h, selectedPeriod, assetSummaries);

                            const assignedGroupIds = assetGroups[h.symbol] || [];
                            const assignedGroupObjects = groups.filter(g => assignedGroupIds.includes(g.id));

                            const isDragging = draggedSymbol === h.symbol;
                            const isOver = dragOverSymbol === h.symbol;

                            return (
                                <tr
                                    key={h.symbol}
                                    {...dragHandlers(h.symbol)}
                                    className={`hover:bg-slate-800/40 transition-colors group select-none ${
                                        isDragging ? 'opacity-30 bg-slate-800/90' : ''
                                    } ${isOver ? 'border-t-2 border-[#1A9FD3] bg-[#1A9FD3]/15' : ''}`}
                                >
                                    {/* Sıra numarası ve sürükleme tutamacı */}
                                    <td className="py-3.5 pl-4 pr-1 text-center whitespace-nowrap">
                                        <div
                                            className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-white transition py-1 rounded"
                                            title="Sırasını değiştirmek için tutup sürükleyin"
                                        >
                                            <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-[#1A9FD3] transition" />
                                            <span className="text-xs font-mono font-bold text-slate-400 w-4 text-center">
                                                {idx + 1}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Sembol, ad ve grup etiketleri */}
                                    <td className="py-3.5 pl-2 pr-3">
                                        <div className="flex items-center gap-3">
                                            <Link
                                                href={`/assets/${h.symbol}`}
                                                className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-white group-hover:border-[#1A9FD3]/50 group-hover:bg-[#1A9FD3]/10 transition shrink-0"
                                                title="Detaylı Grafik ve Analiz"
                                            >
                                                <span className="text-xs font-black font-mono tracking-tight text-[#1A9FD3]">
                                                    {h.symbol.slice(0, 4)}
                                                </span>
                                            </Link>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={`/assets/${h.symbol}`}
                                                        className="font-bold text-white group-hover:text-[#1A9FD3] transition flex items-center gap-1 text-sm sm:text-base"
                                                    >
                                                        <span>{h.symbol}</span>
                                                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-[#1A9FD3]" />
                                                    </Link>
                                                </div>
                                                <p className="text-xs text-slate-400 truncate max-w-[180px] lg:max-w-[240px]">
                                                    {h.asset_name}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    <GroupBadges groups={assignedGroupObjects} />
                                                    <button
                                                        type="button"
                                                        onClick={() => onAssignAsset(h)}
                                                        className="text-[11px] text-slate-500 hover:text-[#1A9FD3] font-medium transition cursor-pointer flex items-center gap-0.5"
                                                        title="Grupları Düzenle"
                                                    >
                                                        <Tag className="w-2.5 h-2.5" />
                                                        <span>
                                                            {assignedGroupObjects.length > 0 ? 'Düzenle' : '+ Gruba Ata'}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-3.5 px-3 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                            {ASSET_TYPE_LABELS[h.asset_type] ?? h.asset_type}
                                        </span>
                                    </td>

                                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                        <div className="text-sm font-semibold text-slate-200 tabular-nums">
                                            {h.total_amount.toLocaleString('tr-TR')} Adet
                                        </div>
                                        <div className="text-xs text-slate-400 tabular-nums">
                                            Ort. {fmt(h.average_cost)}
                                        </div>
                                    </td>

                                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                        <div className="text-sm sm:text-base font-bold text-white font-mono tabular-nums">
                                            {fmt(h.current_price)}
                                        </div>
                                    </td>

                                    {/* Seçili dönemin K/Z'si */}
                                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                        {periodPnl !== null && periodRetVal !== null ? (
                                            <>
                                                <div
                                                    className={`text-sm sm:text-base font-black font-mono tabular-nums ${
                                                        isPeriodPos ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}
                                                >
                                                    {fmt(periodPnl, true)}
                                                </div>
                                                <div
                                                    className={`text-xs font-bold font-mono tabular-nums ${
                                                        isPeriodPos ? 'text-emerald-400/90' : 'text-rose-400/90'
                                                    }`}
                                                >
                                                    {formatSignedPercent(periodRetVal)}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm font-mono text-slate-500">—</div>
                                        )}
                                    </td>

                                    {/* Pozisyonun toplam K/Z'si */}
                                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                        <div
                                            className={`text-sm sm:text-base font-black font-mono tabular-nums ${
                                                isPos ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                        >
                                            {fmt(pnl, true)}
                                        </div>
                                        <div
                                            className={`text-xs font-bold font-mono tabular-nums ${
                                                isPos ? 'text-emerald-400/90' : 'text-rose-400/90'
                                            }`}
                                        >
                                            {formatSignedPercent(pnlPct)}
                                        </div>
                                    </td>

                                    <td className="py-3.5 pl-2 pr-5 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onQuickAddTx(h.symbol)}
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#1A9FD3] text-[#1A9FD3] hover:text-white border border-[#1A9FD3]/30 transition cursor-pointer"
                                                title="Hızlı Alış Ekle"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => onQuickSellTx(h)}
                                                className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 transition cursor-pointer text-xs font-bold"
                                                title="Hızlı Satış Yap"
                                            >
                                                Sat
                                            </button>

                                            {/* Özel grup seçiliyse gruptan çıkarma düğmesi */}
                                            {activeGroupMetrics.isCustomGroup && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveFromCurrentGroup(h.symbol)}
                                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/25 transition cursor-pointer"
                                                    title={`Bu varlığı "${activeGroupMetrics.groupName}" grubundan çıkar`}
                                                >
                                                    <MinusCircle className="w-3.5 h-3.5" />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => onDeleteAsset(h)}
                                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 transition cursor-pointer"
                                                title="Varlığı ve tüm işlemlerini portföyden sil"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                            <Link
                                                href={`/assets/${h.symbol}`}
                                                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                                title="Detaylı Analiz & Grafik"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobil: kartlar */}
            <div className="md:hidden divide-y divide-slate-800/80">
                {items.map((h, idx) => {
                    const { pnl, pnlPct, isPos, periodRetVal, periodPnl, isPeriodPos } =
                        getHoldingRowMetrics(h, selectedPeriod, assetSummaries);

                    const assignedGroupIds = assetGroups[h.symbol] || [];
                    const assignedGroupObjects = groups.filter(g => assignedGroupIds.includes(g.id));

                    const isDragging = draggedSymbol === h.symbol;
                    const isOver = dragOverSymbol === h.symbol;

                    return (
                        <div
                            key={h.symbol}
                            {...dragHandlers(h.symbol)}
                            className={`p-4 space-y-3 transition-all select-none ${
                                isDragging ? 'opacity-30 bg-slate-800/90' : ''
                            } ${isOver ? 'border-t-2 border-[#1A9FD3] bg-[#1A9FD3]/15' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex items-center gap-1 bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700/60 cursor-grab active:cursor-grabbing text-slate-400 hover:text-white shrink-0"
                                        title="Sırasını değiştirmek için tutup sürükleyin"
                                    >
                                        <GripVertical className="w-3.5 h-3.5 text-[#1A9FD3]" />
                                        <span className="text-xs font-mono font-bold text-slate-300">
                                            #{idx + 1}
                                        </span>
                                    </div>

                                    <Link
                                        href={`/assets/${h.symbol}`}
                                        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shrink-0"
                                    >
                                        <span className="text-xs font-black font-mono text-[#1A9FD3]">
                                            {h.symbol.slice(0, 4)}
                                        </span>
                                    </Link>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <Link href={`/assets/${h.symbol}`} className="text-base font-bold text-white">
                                                {h.symbol}
                                            </Link>
                                            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                                {ASSET_TYPE_LABELS[h.asset_type] ?? h.asset_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-1">{h.asset_name}</p>
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                                        Net K/Z (Toplam)
                                    </span>
                                    <div
                                        className={`text-sm sm:text-base font-black font-mono tabular-nums ${
                                            isPos ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                    >
                                        {fmt(pnl, true)}
                                    </div>
                                    <div
                                        className={`text-xs font-bold font-mono tabular-nums ${
                                            isPos ? 'text-emerald-400/90' : 'text-rose-400/90'
                                        }`}
                                    >
                                        {formatSignedPercent(pnlPct)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 py-2 px-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Adet • Ort. Maliyet</span>
                                    <span className="font-semibold text-slate-200 tabular-nums">
                                        {h.total_amount.toLocaleString('tr-TR')} • {fmt(h.average_cost)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block mb-0.5">Güncel Fiyat</span>
                                    <span className="font-bold text-white font-mono tabular-nums text-sm">
                                        {fmt(h.current_price)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block mb-0.5">{periodHeaderLabel}</span>
                                    {periodPnl !== null && periodRetVal !== null ? (
                                        <div>
                                            <span
                                                className={`font-black font-mono tabular-nums text-xs sm:text-sm block ${
                                                    isPeriodPos ? 'text-emerald-400' : 'text-rose-400'
                                                }`}
                                            >
                                                {fmt(periodPnl, true)}
                                            </span>
                                            <span
                                                className={`font-bold font-mono tabular-nums text-[11px] ${
                                                    isPeriodPos ? 'text-emerald-400/90' : 'text-rose-400/90'
                                                }`}
                                            >
                                                {formatSignedPercent(periodRetVal)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="font-mono text-slate-500">—</span>
                                    )}
                                </div>
                                <div className="text-right flex items-end justify-end">
                                    <Link
                                        href={`/assets/${h.symbol}`}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1A9FD3] hover:underline"
                                    >
                                        Grafik & Detay <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>

                            {/* Grup etiketleri ve hızlı işlem düğmeleri */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <GroupBadges groups={assignedGroupObjects} />
                                    <button
                                        type="button"
                                        onClick={() => onAssignAsset(h)}
                                        className="text-[11px] text-slate-400 hover:text-[#1A9FD3] font-medium transition cursor-pointer flex items-center gap-1"
                                    >
                                        <Tag className="w-3 h-3" />
                                        <span>{assignedGroupObjects.length > 0 ? 'Düzenle' : '+ Gruba Ata'}</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => onQuickAddTx(h.symbol)}
                                        className="px-2.5 py-1 rounded-lg bg-[#1A9FD3]/15 hover:bg-[#1A9FD3] text-[#1A9FD3] hover:text-white border border-[#1A9FD3]/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                        title="İşlem Ekle"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>İşlem</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onQuickSellTx(h)}
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                        title="Hızlı Satış Yap"
                                    >
                                        <span>Sat</span>
                                    </button>

                                    {activeGroupMetrics.isCustomGroup && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveFromCurrentGroup(h.symbol)}
                                            className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/25 transition cursor-pointer"
                                            title={`"${activeGroupMetrics.groupName}" grubundan çıkar`}
                                        >
                                            <MinusCircle className="w-3.5 h-3.5" />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => onDeleteAsset(h)}
                                        className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 transition cursor-pointer"
                                        title="Portföyden Sil"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
