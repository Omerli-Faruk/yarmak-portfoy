'use client';

import React from 'react';
import { Search, X, Calendar } from 'lucide-react';

interface DividendFilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedYear: string;
    onYearChange: (year: string) => void;
    availableYears: string[];
}

export default function DividendFilterBar({
    searchQuery,
    onSearchChange,
    selectedYear,
    onYearChange,
    availableYears,
}: DividendFilterBarProps) {
    const yearButtonClass = (active: boolean) =>
        `px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
            active
                ? 'bg-[#1A9FD3] text-white shadow-sm shadow-[#1A9FD3]/20'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
        }`;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Arama */}
            <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Hisse kodu veya şirket ara..."
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Yıl seçimi */}
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <span className="text-xs font-bold text-slate-400 mr-1.5 shrink-0 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Yıl:
                </span>
                <button
                    onClick={() => onYearChange('ALL')}
                    className={yearButtonClass(selectedYear === 'ALL')}
                >
                    Tümü
                </button>
                {availableYears.map(yr => (
                    <button
                        key={yr}
                        onClick={() => onYearChange(yr)}
                        className={yearButtonClass(selectedYear === yr)}
                    >
                        {yr}
                    </button>
                ))}
            </div>
        </div>
    );
}
