'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    TrendingDown,
    ArrowRight,
    PieChart as PieIcon,
    Layers,
    CheckCircle2,
} from 'lucide-react';
import { PRESETS, SHOWCASE_PERIODS, type Period } from './showcasePresets';
import ShowcaseChart from './ShowcaseChart';

// Ana sayfadaki örnek portföy kartı. Veriler sabit ve temsilidir.
// Ana sayfa giriş yapmış kullanıcıyı panele yönlendirdiği için burada yalnızca kayıt bağlantısı var.
export default function PortfolioShowcase() {
    const [activePresetId, setActivePresetId] = useState<string>('balanced');
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3A');

    const activePreset = useMemo(() => {
        return PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    }, [activePresetId]);

    const points = useMemo(() => {
        return activePreset.chartData[selectedPeriod] || activePreset.chartData['3A'];
    }, [activePreset, selectedPeriod]);

    return (
        <div className="w-full max-w-5xl mt-10 rounded-2xl border border-border/80 bg-[#0D1117] shadow-xl overflow-hidden text-left flex flex-col">
            {/* Üst bar ve örnek seçici */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-border/60 bg-[#0B0F15]/90 gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-white tracking-wide">Örnek Portföy</span>
                    <span className="text-[10px] font-mono text-slate-500">• Temsili veriler</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {PRESETS.map((p) => {
                        const isSelected = p.id === activePresetId;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setActivePresetId(p.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                                    isSelected
                                        ? 'bg-primary/20 text-white border border-primary/40 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-surface/50 border border-transparent'
                                }`}
                            >
                                <p.icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{p.shortTitle}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Solda grafik, sağda varlıklar */}
            <div className="flex flex-col lg:flex-row items-stretch gap-6 p-5 sm:p-6 bg-[#0D1117]">

                {/* Portföy değeri, grafik ve dağılım */}
                <div className="flex-1 flex flex-col justify-between bg-[#131924]/70 border border-border/50 rounded-xl p-5">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-medium">Toplam Portföy Değeri</span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                                    {activePreset.badge}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-3 mt-1">
                                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                                    {activePreset.totalValue} ₺
                                </span>
                                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <TrendingUp className="size-3.5" />
                                    {activePreset.totalReturnPercent}
                                </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                                <span>Bugün:</span>
                                <span className={activePreset.isDailyPositive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                    {activePreset.dailyChange} ₺ ({activePreset.dailyPercent})
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 bg-surface/60 p-1 rounded-lg border border-border/40 self-start sm:self-auto">
                            {SHOWCASE_PERIODS.map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setSelectedPeriod(period)}
                                    className={`text-[11px] px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                                        selectedPeriod === period
                                            ? 'bg-primary text-white font-bold shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ShowcaseChart points={points} />

                    {/* Varlık dağılımı çubuğu */}
                    <div className="mt-4 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                            <span className="font-medium flex items-center gap-1.5">
                                <Layers className="size-3 text-primary" /> Varlık Dağılımı
                            </span>
                            <span className="text-slate-400">Toplam 100%</span>
                        </div>

                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-surface">
                            {activePreset.allocations.map((alloc) => (
                                <div
                                    key={alloc.label}
                                    style={{ width: `${alloc.percent}%` }}
                                    className={`${alloc.color} transition-all duration-300`}
                                    title={`${alloc.label}: ${alloc.percent}%`}
                                />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px]">
                            {activePreset.allocations.map((alloc) => (
                                <div key={alloc.label} className="flex items-center gap-1.5">
                                    <span className={`size-2 rounded-full ${alloc.color}`} />
                                    <span className="text-slate-300 font-medium">{alloc.label}</span>
                                    <span className="font-mono text-slate-400">{alloc.percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Örnek varlıklar ve kayıt bağlantısı */}
                <div className="w-full lg:w-84 flex flex-col justify-between gap-3 bg-[#131924]/70 border border-border/50 rounded-xl p-5">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <PieIcon className="size-3.5 text-primary" /> Portföy Varlıkları
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border/60 text-slate-400">
                                {activePreset.holdings.length} Varlık
                            </span>
                        </div>

                        <div className="flex flex-col gap-2">
                            {activePreset.holdings.map((h) => (
                                <div
                                    key={h.symbol}
                                    className="flex items-center justify-between p-2 rounded-lg bg-surface/30 border border-border/30 hover:border-primary/40 transition group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-lg bg-[#0D1117] border border-border/60 flex items-center justify-center font-mono font-bold text-xs text-white group-hover:text-primary transition">
                                            {h.symbol.slice(0, 3)}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-white font-mono">{h.symbol}</span>
                                                <span className="text-[9px] font-mono px-1 rounded bg-surface/80 text-slate-400 border border-border/40">
                                                    {h.weight}%
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={h.name}>
                                                {h.name}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold font-mono text-white">
                                            {h.price}
                                        </span>
                                        <span
                                            className={`text-[10px] font-mono font-semibold flex items-center gap-0.5 ${
                                                h.positive ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                        >
                                            {h.positive ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                                            {h.change}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Link
                                href="/register"
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition cursor-pointer"
                            >
                                <span>Kendi Portföyünü Oluştur</span>
                                <ArrowRight className="size-3.5" />
                            </Link>
                            <span className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                                <CheckCircle2 className="size-3 text-emerald-400" /> Ücretsiz • BIST, TEFAS ve altın takibi
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
