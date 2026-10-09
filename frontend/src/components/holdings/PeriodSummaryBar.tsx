'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import type { Period } from '@/types';
import { PERIOD_LABELS, getPeriodHeaderLabel } from '@/lib/periodUtils';
import { formatSignedPercent } from '@/lib/formatters';

// Varlıklarım sayfasında seçilebilen getiri dönemleri (5Y yok)
const HOLDINGS_PERIODS: Period[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'];

interface PeriodSummaryBarProps {
    selectedPeriod: Period;
    onPeriodChange: (period: Period) => void;
    metrics: {
        isCustomGroup: boolean;
        groupName: string;
        totalVal: number;
        pnlAmount: number;
        pnlPercent: number;
    };
    totalDividends: number;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
}

// Getiri dönemi seçici ile seçili grubun (ya da tüm portföyün) değer ve K/Z özeti
export default function PeriodSummaryBar({
    selectedPeriod,
    onPeriodChange,
    metrics,
    totalDividends,
    fmt,
}: PeriodSummaryBarProps) {
    const isPos = metrics.pnlAmount >= 0;

    let pnlLabel: string;
    if (selectedPeriod === 'ALL') {
        pnlLabel = metrics.isCustomGroup ? 'Grup Toplam Getiri' : 'Toplam Getiri (Tümü)';
    } else {
        pnlLabel = getPeriodHeaderLabel(selectedPeriod);
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5 shrink-0">
                    <Clock className="w-4 h-4 text-slate-400" /> Getiri Dönemi:
                </span>
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 overflow-x-auto gap-1 no-scrollbar touch-pan-x max-w-full">
                    {HOLDINGS_PERIODS.map(p => (
                        <button
                            key={p}
                            onClick={() => onPeriodChange(p)}
                            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer shrink-0 ${
                                selectedPeriod === p
                                    ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold shadow-sm shadow-[#1A9FD3]/20'
                                    : 'text-slate-300 hover:text-[#1A9FD3] hover:bg-[#1A9FD3]/15'
                            }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toplam portföy ya da seçili grubun değeri ve dönem K/Z'si */}
            <div className="flex items-center gap-6 sm:gap-10 self-stretch lg:self-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                <div>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">
                        {metrics.isCustomGroup ? `${metrics.groupName} Değeri` : 'Toplam Portföy Değeri'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums mt-0.5">
                        {fmt(metrics.isCustomGroup ? metrics.totalVal : (metrics.totalVal + totalDividends))}
                    </p>
                    {!metrics.isCustomGroup && totalDividends > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium flex items-center gap-1.5">
                            <span>Varlıklar: <strong className="text-slate-300 font-mono font-medium">{fmt(metrics.totalVal)}</strong></span>
                            <span>•</span>
                            <span>Nakit Temettü: <strong className="text-emerald-400 font-mono">+{fmt(totalDividends)}</strong></span>
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">
                        {pnlLabel}
                    </p>
                    <p className={`text-2xl sm:text-3xl font-black flex items-center justify-end tracking-tight tabular-nums mt-0.5 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmt(metrics.pnlAmount, true)}
                        <span className={`text-xs sm:text-sm font-bold ml-2 px-2 py-0.5 rounded font-mono ${isPos ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'}`}>
                            {formatSignedPercent(metrics.pnlPercent)}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
