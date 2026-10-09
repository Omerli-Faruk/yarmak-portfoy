'use client';

import React from 'react';
import { Search, X, RefreshCw, Plus } from 'lucide-react';

export type TxTypeFilter = 'ALL' | 'BUY' | 'SELL';

const ASSET_TYPE_FILTERS = [
    { id: 'ALL', label: 'Tüm Türler' },
    { id: 'HISSE', label: 'Hisse' },
    { id: 'FON', label: 'Fon' },
    { id: 'ALTIN', label: 'Altın' },
    { id: 'DOVIZ', label: 'Döviz' },
];

interface TxFilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    typeFilter: TxTypeFilter;
    onTypeFilterChange: (value: TxTypeFilter) => void;
    assetTypeFilter: string;
    onAssetTypeFilterChange: (value: string) => void;
    refreshing: boolean;
    onRefresh: () => void;
    onAddTx: () => void;
}

export default function TxFilterBar({
    searchQuery,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    assetTypeFilter,
    onAssetTypeFilterChange,
    refreshing,
    onRefresh,
    onAddTx,
}: TxFilterBarProps) {
    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">

            {/* Arama ve filtreler */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Sembol veya varlık ara..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary transition"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                {/* İşlem tipi: Tümü / Alış / Satış */}
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
                    {(['ALL', 'BUY', 'SELL'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => onTypeFilterChange(t)}
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

                {/* Varlık türü */}
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs hidden md:flex">
                    {ASSET_TYPE_FILTERS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onAssetTypeFilterChange(item.id)}
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

            {/* Yenile ve yeni işlem */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-primary transition cursor-pointer disabled:opacity-50"
                    title="İşlemleri Yenile"
                >
                    <RefreshCw className={`size-4 ${refreshing ? 'animate-spin text-slate-400' : ''}`} />
                </button>
                <button
                    onClick={onAddTx}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm shadow-primary/20 cursor-pointer active:scale-95"
                >
                    <Plus className="size-4 stroke-[2.5]" />
                    <span>Yeni İşlem</span>
                </button>
            </div>
        </div>
    );
}
