'use client';

import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export type HoldingsSortType = 'custom' | 'val_desc' | 'pnl_desc' | 'pnl_asc' | 'name_asc' | 'amount_desc';

export const HOLDINGS_SORT_OPTIONS: { value: HoldingsSortType; label: string }[] = [
    { value: 'custom', label: 'Özel Sıralamam (Manuel)' },
    { value: 'val_desc', label: 'En Yüksek Değer (Azalan)' },
    { value: 'pnl_desc', label: 'En Çok Kazandıranlar (Kâr %)' },
    { value: 'pnl_asc', label: 'En Çok Kaybettirenler (Zarar %)' },
    { value: 'name_asc', label: 'Alfabetik (A-Z)' },
    { value: 'amount_desc', label: 'Adet / Lot (Azalan)' },
];

interface HoldingsToolbarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    sortBy: HoldingsSortType;
    onSortChange: (sort: HoldingsSortType) => void;
}

// Varlık listesinin üstündeki arama kutusu ve sıralama menüsü
export default function HoldingsToolbar({ searchQuery, onSearchChange, sortBy, onSortChange }: HoldingsToolbarProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Sembol veya varlık adı ara..."
                    className="w-full bg-slate-800/80 border border-slate-700/70 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full transition"
                        title="Aramayı Temizle"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-400">Sırala:</span>
                    <select
                        value={sortBy}
                        onChange={e => onSortChange(e.target.value as HoldingsSortType)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3] transition cursor-pointer"
                    >
                        {HOLDINGS_SORT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
