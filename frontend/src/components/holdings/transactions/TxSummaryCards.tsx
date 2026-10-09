'use client';

import React from 'react';
import { TrendingUp, Receipt, ArrowDownRight } from 'lucide-react';

export interface TxMetrics {
    totalCount: number;
    buyCount: number;
    sellCount: number;
    totalBuyVolume: number;
    totalSellVolume: number;
    totalRealizedPnL: number;
    totalCommission: number;
}

interface TxSummaryCardsProps {
    metrics: TxMetrics;
    fmt: (value: number, showPlus?: boolean) => string;
}

export default function TxSummaryCards({ metrics, fmt }: TxSummaryCardsProps) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Toplam işlem sayısı */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5">
                        <Receipt className="size-4 text-slate-400" /> Toplam İşlem
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border/50 text-slate-400">
                        Kayıtlar
                    </span>
                </div>
                <div className="mt-3">
                    <span className="text-xl sm:text-2xl font-black font-mono text-white">
                        {metrics.totalCount}
                    </span>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">{metrics.buyCount} Alış</span>
                        <span>•</span>
                        <span className="text-rose-400 font-semibold">{metrics.sellCount} Satış</span>
                    </div>
                </div>
            </div>

            {/* Alış hacmi (komisyon hariç) */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5">
                        <ArrowDownRight className="size-4 text-slate-400" /> Alış Hacmi
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold">
                        Giriş
                    </span>
                </div>
                <div className="mt-3">
                    <span className="text-lg sm:text-xl font-black font-mono text-white">
                        {fmt(metrics.totalBuyVolume)}
                    </span>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                        Alışların toplam tutarı (komisyon hariç)
                    </div>
                </div>
            </div>

            {/* Satışlardan gerçekleşen kâr/zarar */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5">
                        <TrendingUp className="size-4 text-slate-400" /> Gerçekleşen K/Z
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        metrics.totalRealizedPnL >= 0
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                        Satışlardan
                    </span>
                </div>
                <div className="mt-3">
                    <span className={`text-lg sm:text-xl font-black font-mono ${
                        metrics.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                        {fmt(metrics.totalRealizedPnL, true)}
                    </span>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                        Satışlardan gerçekleşen kâr/zarar
                    </div>
                </div>
            </div>

            {/* Toplam komisyon */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5">
                        <Receipt className="size-4 text-slate-400" /> Komisyon Gideri
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold">
                        Gider
                    </span>
                </div>
                <div className="mt-3">
                    <span className="text-lg sm:text-xl font-black font-mono text-slate-200">
                        {fmt(metrics.totalCommission)}
                    </span>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                        Girdiğiniz toplam komisyon
                    </div>
                </div>
            </div>
        </div>
    );
}
