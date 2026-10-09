'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Layers, Plus, Search, X } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ASSET_TYPE_LABELS, formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import type { MarketAssetItem } from '@/types';

export type MarketCategory = 'ALL' | 'HISSE' | 'FON' | 'EMTIA';
export type MarketSort = 'gainers' | 'losers' | 'popular' | 'alpha';

const CATEGORY_OPTIONS: { id: MarketCategory; label: string }[] = [
    { id: 'ALL', label: 'Tümü' },
    { id: 'HISSE', label: 'BIST Hisseleri' },
    { id: 'FON', label: 'TEFAS Fonları' },
    { id: 'EMTIA', label: 'Altın & Döviz' },
];

const SORT_OPTIONS: { id: MarketSort; label: string }[] = [
    { id: 'gainers', label: 'En Çok Artanlar' },
    { id: 'losers', label: 'En Çok Düşenler' },
    { id: 'popular', label: 'Seçili hisseler önce' },
    { id: 'alpha', label: 'A-Z' },
];

interface MarketScreenerProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    category: MarketCategory;
    onCategoryChange: (category: MarketCategory) => void;
    sort: MarketSort;
    onSortChange: (sort: MarketSort) => void;
    debouncedSearch: string;
    totalFound: number | null;
    loading: boolean;
    items: MarketAssetItem[];
    onQuickAdd: (item: MarketAssetItem) => void;
}

// Filtre durumu sayfada tutulur; bu bileşen yalnızca listeyi ve kontrolleri çizer
export default function MarketScreener({
    searchQuery,
    onSearchChange,
    category,
    onCategoryChange,
    sort,
    onSortChange,
    debouncedSearch,
    totalFound,
    loading,
    items,
    onQuickAdd,
}: MarketScreenerProps) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            {/* Başlık ve arama */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="size-5 text-slate-400" />
                        Varlık Keşif Listesi
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Kriterlerinize göre hisse ve fonları filtreleyin, anında portföyünüze ekleyin.
                    </p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Hisse, fon veya sembol ara..."
                        className="w-full bg-slate-800/90 border border-slate-700/70 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Kategori ve sıralama */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-1.5 bg-slate-800/70 p-1 rounded-xl border border-slate-700/60 overflow-x-auto no-scrollbar">
                    {CATEGORY_OPTIONS.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => onCategoryChange(cat.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                                category === cat.id
                                    ? 'bg-[#1A9FD3] text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">Sırala:</span>
                    <div className="flex items-center gap-1 bg-slate-800/70 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold">
                        {SORT_OPTIONS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => onSortChange(s.id)}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                                    sort === s.id
                                        ? 'bg-slate-700 text-white font-bold'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Arama sonucu sayısı */}
            {debouncedSearch && totalFound !== null && (
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-2">
                        <Search className="size-3.5 text-[#1A9FD3]" />
                        <span>
                            <strong>&quot;{debouncedSearch}&quot;</strong> için <strong>{totalFound}</strong> varlık bulundu
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                        En alakalılar üstte, benzer varlıklar aşağıda listelenir
                    </span>
                </div>
            )}

            {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                    <LoadingSpinner fullScreen={false} message="Piyasa varlıkları yükleniyor..." />
                </div>
            ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                    <Activity className="size-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">
                        {debouncedSearch ? `"${debouncedSearch}" aramasına uygun veya benzer varlık bulunamadı.` : 'Aramanıza uygun varlık bulunamadı.'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Farklı bir sembol veya arama terimi deneyebilirsiniz.</p>
                </div>
            ) : (
                <div className="overflow-x-auto custom-horizontal-scrollbar">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                <th className="py-3 px-3">Varlık</th>
                                <th className="py-3 px-3">Tür</th>
                                <th className="py-3 px-3 text-right">Fiyat</th>
                                <th className="py-3 px-3 text-right">Günlük Değişim</th>
                                <th className="py-3 px-3 text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                            {items.map((item, idx) => (
                                <tr key={`scr-${item.id}-${item.symbol}-${idx}`} className="hover:bg-slate-800/30 transition group">
                                    <td className="py-3 px-3">
                                        <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 hover:text-[#1A9FD3] transition">
                                            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                                {item.symbol.slice(0, 2)}
                                            </div>
                                            <div>
                                                <span className="font-bold text-white group-hover:text-[#1A9FD3] transition font-mono">
                                                    {item.symbol}
                                                </span>
                                                <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                                                    {item.name}
                                                </p>
                                            </div>
                                        </Link>
                                    </td>

                                    <td className="py-3 px-3">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                            {ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}
                                        </span>
                                    </td>

                                    <td className="py-3 px-3 text-right font-bold text-slate-200 tabular-nums font-mono">
                                        {formatPriceTR(item.price)}
                                    </td>

                                    <td className="py-3 px-3 text-right">
                                        <span className={`inline-flex items-center font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
                                            item.positive
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-rose-500/10 text-rose-400'
                                        }`}>
                                            {formatSignedPercent(item.change_value)}
                                        </span>
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Link
                                                href={`/assets/${item.symbol}`}
                                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-semibold text-[11px]"
                                            >
                                                Detay
                                            </Link>
                                            <button
                                                onClick={() => onQuickAdd(item)}
                                                className="px-2.5 py-1 rounded-lg bg-[#1A9FD3]/20 hover:bg-[#1A9FD3] text-[#1A9FD3] hover:text-white border border-[#1A9FD3]/30 transition font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus className="size-3 stroke-[3]" />
                                                <span>Ekle</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
