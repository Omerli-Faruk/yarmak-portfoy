'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ASSET_TYPE_LABELS, formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import type { MarketAssetItem } from '@/types';

interface MarketLeaderColumnProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    items: MarketAssetItem[];
    loading: boolean;
    emptyText: string;
    keyPrefix: string;
    onQuickAdd: (item: MarketAssetItem) => void;
}

// Yükselenler, düşenler ve seçili hisseler için aynı kart kullanılır
export default function MarketLeaderColumn({
    title,
    subtitle,
    icon,
    items,
    loading,
    emptyText,
    keyPrefix,
    onQuickAdd,
}: MarketLeaderColumnProps) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                        {icon}
                    </div>
                    <h3 className="font-bold text-white text-sm">{title}</h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">{subtitle}</span>
            </div>

            <div className="space-y-2 flex-1">
                {items.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                        {loading ? 'Yükleniyor...' : emptyText}
                    </p>
                ) : (
                    items.map((item, idx) => (
                        <div
                            key={`${keyPrefix}-${item.id}-${item.symbol}-${idx}`}
                            className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700/50"
                        >
                            <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                    {item.symbol.slice(0, 2)}
                                </div>
                                <div className="truncate">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs text-white group-hover:text-[#1A9FD3] transition font-mono">
                                            {item.symbol}
                                        </span>
                                        <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400 font-medium">
                                            {ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate">{item.name}</p>
                                </div>
                            </Link>

                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                <div className="text-right">
                                    <div className="text-xs font-semibold text-slate-200 tabular-nums">
                                        {formatPriceTR(item.price)}
                                    </div>
                                    <div
                                        className={`text-[11px] font-bold font-mono tabular-nums ${
                                            item.positive ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                    >
                                        {formatSignedPercent(item.change_value)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onQuickAdd(item)}
                                    title="Portföyüme Ekle"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#1A9FD3] text-slate-300 hover:text-white transition cursor-pointer"
                                >
                                    <Plus className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
