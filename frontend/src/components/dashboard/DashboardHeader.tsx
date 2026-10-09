'use client';

import Link from 'next/link';
import { Layers, RefreshCw, ArrowUpRight } from 'lucide-react';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import type { Currency } from '@/hooks/useCurrency';

interface DashboardHeaderProps {
    username?: string;
    currency: Currency;
    currencyDisabled: boolean;
    onToggleCurrency: () => void;
    refreshing: boolean;
    onRefresh: () => void;
}

export default function DashboardHeader({
    username,
    currency,
    currencyDisabled,
    onToggleCurrency,
    refreshing,
    onRefresh,
}: DashboardHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Portföy Genel Bakış
                    </h1>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        15 Dk. Gecikmeli
                    </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                    Hoş geldiniz, <span className="text-slate-200 font-semibold">{username}</span>. Portföyünüzün güncel durumu ve varlık dağılımı.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <CurrencyToggle currency={currency} onToggle={onToggleCurrency} disabled={currencyDisabled} />

                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3] transition disabled:opacity-50 cursor-pointer"
                    title="Portföyü Yenile (Önbelleği Temizle)"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-400' : ''}`} />
                </button>

                <Link
                    href="/holdings"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20"
                >
                    <Layers className="w-4 h-4" />
                    <span>Varlıklarımı Yönet & Grupla</span>
                    <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
            </div>
        </div>
    );
}
