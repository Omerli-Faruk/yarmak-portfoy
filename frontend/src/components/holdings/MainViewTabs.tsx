'use client';

import React from 'react';
import { Briefcase, Clock, Coins, type LucideIcon } from 'lucide-react';

export type MainViewTab = 'positions' | 'transactions' | 'dividends';

const TABS: { id: MainViewTab; label: string; icon: LucideIcon; showCount?: boolean }[] = [
    { id: 'positions', label: 'Portföy Pozisyonlarım', icon: Briefcase, showCount: true },
    { id: 'transactions', label: 'İşlem Geçmişi', icon: Clock },
    { id: 'dividends', label: 'Temettülerim', icon: Coins },
];

interface MainViewTabsProps {
    tab: MainViewTab;
    positionsCount: number;
    onChange: (tab: MainViewTab) => void;
}

// Pozisyonlar / İşlem Geçmişi / Temettülerim sekmeleri
export default function MainViewTabs({ tab, positionsCount, onChange }: MainViewTabsProps) {
    return (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
            {TABS.map(({ id, label, icon: Icon, showCount }) => {
                const isActive = tab === id;
                return (
                    <button
                        key={id}
                        onClick={() => onChange(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                            isActive
                                ? 'bg-[#1A9FD3] text-white shadow-md shadow-[#1A9FD3]/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        {showCount && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                                {positionsCount}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
