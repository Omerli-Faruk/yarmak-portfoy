'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import type { Currency } from '@/hooks/useCurrency';
import CurrencyToggle from '@/components/ui/CurrencyToggle';

interface HoldingsHeaderProps {
    currency: Currency;
    currencyDisabled: boolean;
    onToggleCurrency: () => void;
    onAddTx: () => void;
    refreshing: boolean;
    onRefresh: () => void;
}

// Sayfa başlığı, para birimi düğmesi, işlem ekleme ve yenileme
export default function HoldingsHeader({
    currency,
    currencyDisabled,
    onToggleCurrency,
    onAddTx,
    refreshing,
    onRefresh,
}: HoldingsHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-sm shadow-sm">
            <div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition" title="Portföyüme dön">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Varlıklarım & Gruplar
                    </h1>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                    Sahip olduğunuz hisse, fon ve varlıkları dilediğiniz gibi gruplayın, sıralayın ve inceleyin.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <CurrencyToggle
                    currency={currency}
                    onToggle={onToggleCurrency}
                    disabled={currencyDisabled}
                    className="sm:text-sm"
                />

                <button
                    onClick={onAddTx}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20 cursor-pointer active:scale-95"
                >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>İşlem Ekle</span>
                </button>

                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3] transition disabled:opacity-50 cursor-pointer"
                    title="Yenile (Önbelleği Temizle)"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1A9FD3]' : ''}`} />
                </button>
            </div>
        </div>
    );
}
