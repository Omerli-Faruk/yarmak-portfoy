'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Briefcase, Layers, Receipt } from 'lucide-react';
import type { Dividend, UserHolding } from '@/types';
import type { Currency } from '@/hooks/useCurrency';
import { formatCurrency, formatSignedPercent, formatTRY } from '@/lib/formatters';
import { normalizeDividend } from '@/lib/normalize';

// Sayfada bir kez hesaplanan toplamlar (TL)
export interface DashboardTotals {
    totalVal: number;            // açık pozisyonlar + nakit temettü
    equityVal: number;           // açık pozisyonlar
    totalDividends: number;
    totalCost: number;
    realizedPnL: number;
    totalCombinedProfit: number; // sermaye K/Z + temettü + gerçekleşen K/Z
    totalReturnPct: number;
    totalCommission: number;
}

interface SummaryCardsProps {
    holdings: UserHolding[];
    dividends: Dividend[];
    totals: DashboardTotals;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    currency: Currency;      // ekranda gösterilen para birimi
    usdRate: number | null;  // kur alınamadıysa null
}

export default function SummaryCards({ holdings, dividends, totals, fmt, currency, usdRate }: SummaryCardsProps) {
    const {
        totalVal,
        equityVal,
        totalDividends,
        totalCost,
        realizedPnL,
        totalCombinedProfit,
        totalReturnPct,
        totalCommission,
    } = totals;
    const isProfit = totalCombinedProfit >= 0;

    // Varlık türlerine göre adetler
    const counts = useMemo(() => {
        let hisse = 0;
        let fon = 0;
        let altin = 0;
        let doviz = 0;
        holdings.forEach(h => {
            if (h.asset_type === 'HISSE') hisse++;
            else if (h.asset_type === 'FON') fon++;
            else if (h.asset_type === 'ALTIN') altin++;
            else if (h.asset_type === 'DOVIZ') doviz++;
        });
        return { hisse, fon, altin, doviz, total: holdings.length };
    }, [holdings]);

    // Temettülerden kesilen stopaj ve toplam komisyon
    const taxInfo = useMemo(() => {
        let totalDividendTax = 0;
        if (dividends && Array.isArray(dividends)) {
            dividends.forEach(d => {
                totalDividendTax += normalizeDividend(d).tax;
            });
        }
        return {
            totalTax: totalDividendTax,
            totalDeductions: totalDividendTax + totalCommission,
        };
    }, [dividends, totalCommission]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Toplam portföy değeri */}
            <div className="lg:col-span-12 xl:col-span-5 bg-slate-900 border border-slate-800/90 rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Toplam Portföy Değeri</span>
                        <Briefcase className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight tabular-nums py-1">
                        {fmt(totalVal)}
                    </p>
                    {currency === 'USD' ? (
                        <p className="text-sm text-slate-400 mt-2 tabular-nums font-mono">
                            {formatTRY(totalVal)} (TL Karşılığı)
                        </p>
                    ) : usdRate !== null && (
                        <p className="text-sm text-slate-400 mt-2 tabular-nums font-mono">
                            {formatCurrency(totalVal, 'USD', usdRate)} (USD Karşılığı)
                        </p>
                    )}
                    {totalDividends > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                            <span className="text-slate-400">
                                Varlıklar: <strong className="text-slate-300 font-mono font-medium">{fmt(equityVal)}</strong>
                            </span>
                            <span className="text-slate-400">
                                Nakit Temettü: <strong className="font-semibold text-emerald-400 font-mono tabular-nums">+{fmt(totalDividends)}</strong>
                            </span>
                        </div>
                    )}
                </div>
                {usdRate !== null && (
                    <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Kullanılan Kur:</span>
                        <span className="font-semibold text-slate-300 font-mono">1 $ = {formatTRY(usdRate)}</span>
                    </div>
                )}
            </div>

            <div className="lg:col-span-12 xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Toplam getiri: sermaye K/Z + temettü + satış K/Z */}
                <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                        <span>Toplam Getiri (Net K/Z)</span>
                        {isProfit ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-rose-400" />
                        )}
                    </div>
                    <div>
                        <p className={`text-xl sm:text-2xl font-black tracking-tight tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmt(totalCombinedProfit, true)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded font-mono tabular-nums ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {formatSignedPercent(totalReturnPct)}
                            </span>
                            <span className="text-xs text-slate-400">Toplam Getiri</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-400">
                            <span>Maliyet:</span>
                            <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(totalCost)}</span>
                        </div>
                        {totalDividends > 0 && (
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="text-emerald-400/90">Temettü:</span>
                                <span className="font-semibold text-emerald-400 font-mono tabular-nums">+{fmt(totalDividends)}</span>
                            </div>
                        )}
                        {realizedPnL !== 0 && (
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Satış K/Z:</span>
                                <span className={`font-semibold font-mono tabular-nums ${realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fmt(realizedPnL, true)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vergi ve komisyon */}
                <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                        <span>Vergi & Komisyon</span>
                        <Receipt className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-xl sm:text-2xl font-black text-slate-200 tracking-tight tabular-nums">
                            {fmt(taxInfo.totalDeductions)}
                        </p>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-1">
                            Stopaj + Komisyon
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400">
                            <span>Stopaj:</span>
                            <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(taxInfo.totalTax)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                            <span>Komisyon:</span>
                            <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(totalCommission)}</span>
                        </div>
                    </div>
                </div>

                {/* Varlık adetleri */}
                <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                        <span>Varlık Dağılımı</span>
                        <Layers className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
                            {counts.total} <span className="text-sm font-medium text-slate-400">Varlık</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-1">
                            Portföydeki varlıklar
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-xs">
                        <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                            <span className="text-slate-400 font-medium">Hisse:</span>
                            <span className="text-white font-mono font-bold tabular-nums">{counts.hisse}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                            <span className="text-slate-400 font-medium">Fon:</span>
                            <span className="text-white font-mono font-bold tabular-nums">{counts.fon}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                            <span className="text-slate-400 font-medium">Altın:</span>
                            <span className="text-white font-mono font-bold tabular-nums">{counts.altin}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                            <span className="text-slate-400 font-medium">Döviz:</span>
                            <span className="text-white font-mono font-bold tabular-nums">{counts.doviz}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
