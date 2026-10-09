'use client';

import React from 'react';
import { Wallet, Receipt, Building2, Calendar } from 'lucide-react';

export interface DividendMetrics {
    totalGross: number;
    totalTax: number;
    totalNet: number;
    uniqueAssetsCount: number;
    totalCount: number;
}

interface DividendSummaryCardsProps {
    metrics: DividendMetrics;
    fmt: (value: number, showPlus?: boolean) => string;
}

export default function DividendSummaryCards({ metrics, fmt }: DividendSummaryCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hesaba geçen net temettü */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Net Nakit Temettü</span>
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                        <Wallet className="w-4 h-4" />
                    </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                    {fmt(metrics.totalNet)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Yatırım hesabınıza yatan net nakit</span>
                </div>
            </div>

            {/* Stopaj öncesi brüt toplam */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Toplam Brüt Tutar</span>
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                        <Receipt className="w-4 h-4" />
                    </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                    {fmt(metrics.totalGross)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Stopaj kesilmeden önceki toplam tutar</span>
                </div>
            </div>

            {/* Ödeme yapan şirket sayısı */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Ödeme Yapan Şirketler</span>
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                        <Building2 className="w-4 h-4" />
                    </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                    {metrics.uniqueAssetsCount} <span className="text-sm font-normal text-slate-400">Şirket</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Portföyünüzden temettü verenler</span>
                </div>
            </div>

            {/* Kayıt sayısı */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Ödeme Adedi</span>
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400">
                        <Calendar className="w-4 h-4" />
                    </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                    {metrics.totalCount} <span className="text-sm font-normal text-slate-400">İşlem</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Kayıtlı toplam temettü hareketi</span>
                </div>
            </div>
        </div>
    );
}
