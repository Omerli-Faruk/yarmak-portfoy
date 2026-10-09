'use client';

import { Search, X } from 'lucide-react';

export type AlertFilter = 'ALL' | 'PENDING' | 'TRIGGERED';

interface AlertFilterBarProps {
    filterTab: AlertFilter;
    onFilterTab: (tab: AlertFilter) => void;
    counts: Record<AlertFilter, number>;
    searchQuery: string;
    onSearch: (query: string) => void;
}

const FILTER_TABS: { id: AlertFilter; label: string }[] = [
    { id: 'ALL', label: 'Tümü' },
    { id: 'PENDING', label: 'Aktif Bekleyenler' },
    { id: 'TRIGGERED', label: 'Tetiklenenler' },
];

export default function AlertFilterBar({ filterTab, onFilterTab, counts, searchQuery, onSearch }: AlertFilterBarProps) {
    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center p-1 bg-surface/70 border border-white/5 rounded-xl self-start">
                {FILTER_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onFilterTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            filterTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab.label} ({counts[tab.id]})
                    </button>
                ))}
            </div>

            <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Sembol veya varlık ara..."
                    className="w-full bg-surface/70 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-slate-500 focus:outline-none focus:border-primary transition"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
