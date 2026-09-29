'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import {
    TrendingUp,
    TrendingDown,
    ArrowRight,
    PieChart as PieIcon,
    Sparkles,
    Shield,
    Layers,
    Activity,
    CheckCircle2
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   ÖRNEK PORTFÖY STRATEJİ VERİLERİ (SHOWCASE PRESETS)
   ═══════════════════════════════════════════════════════════════ */
type Period = '1A' | '3A' | '6M' | '1Y' | 'TÜMÜ';

interface HoldingItem {
    symbol: string;
    name: string;
    type: 'HISSE' | 'FON' | 'ALTIN' | 'DOVIZ' | 'NAKIT';
    weight: number;
    price: string;
    change: string;
    positive: boolean;
}

interface AllocationItem {
    label: string;
    percent: number;
    color: string;
    text: string;
}

interface Preset {
    id: string;
    title: string;
    shortTitle: string;
    icon: string;
    badge: string;
    totalValue: string;
    totalProfit: string;
    totalReturnPercent: string;
    dailyChange: string;
    dailyPercent: string;
    isDailyPositive: boolean;
    allocations: AllocationItem[];
    holdings: HoldingItem[];
    chartData: Record<Period, number[]>;
}

const PRESETS: Preset[] = [
    {
        id: 'balanced',
        title: 'Dengeli Karma Portföy',
        shortTitle: 'Dengeli Karma',
        icon: '🎯',
        badge: 'BIST + TEFAS + Altın',
        totalValue: '548.250,00',
        totalProfit: '+142.300,00',
        totalReturnPercent: '+35,04%',
        dailyChange: '+4.280,00',
        dailyPercent: '+0,78%',
        isDailyPositive: true,
        allocations: [
            { label: 'Hisse Senedi', percent: 40, color: 'bg-[#1A9FD3]', text: 'text-[#1A9FD3]' },
            { label: 'TEFAS Fonu', percent: 30, color: 'bg-indigo-500', text: 'text-indigo-400' },
            { label: 'Kıymetli Maden', percent: 20, color: 'bg-amber-400', text: 'text-amber-400' },
            { label: 'Döviz & Nakit', percent: 10, color: 'bg-emerald-400', text: 'text-emerald-400' },
        ],
        holdings: [
            { symbol: 'THYAO', name: 'Türk Hava Yolları', type: 'HISSE', weight: 20, price: '₺318,50', change: '+2,40%', positive: true },
            { symbol: 'TI2', name: 'İş Portföy Fonu', type: 'FON', weight: 30, price: '₺4,85', change: '+1,15%', positive: true },
            { symbol: 'ALTIN', name: 'Gram Altın', type: 'ALTIN', weight: 20, price: '₺6.787,00', change: '+0,80%', positive: true },
            { symbol: 'ASELS', name: 'Aselsan Elektronik', type: 'HISSE', weight: 20, price: '₺64,20', change: '+3,10%', positive: true },
            { symbol: 'USDTRY', name: 'Amerikan Doları', type: 'DOVIZ', weight: 10, price: '₺48,83', change: '+0,06%', positive: true },
        ],
        chartData: {
            '1A': [512, 515, 518, 514, 520, 526, 522, 529, 535, 532, 541, 548],
            '3A': [470, 478, 472, 485, 492, 490, 505, 512, 520, 525, 538, 548],
            '6M': [410, 422, 435, 430, 448, 460, 475, 482, 500, 515, 532, 548],
            '1Y': [340, 360, 375, 390, 410, 430, 450, 465, 490, 510, 530, 548],
            'TÜMÜ': [220, 250, 280, 310, 345, 380, 420, 455, 490, 515, 535, 548],
        },
    },
    {
        id: 'growth',
        title: 'BIST Büyüme & Teknoloji',
        shortTitle: 'BIST Büyüme',
        icon: '🚀',
        badge: 'Yüksek Getiri Odaklı',
        totalValue: '426.800,00',
        totalProfit: '+152.600,00',
        totalReturnPercent: '+55,65%',
        dailyChange: '+7.940,00',
        dailyPercent: '+1,89%',
        isDailyPositive: true,
        allocations: [
            { label: 'BIST 100 Hisse', percent: 75, color: 'bg-[#1A9FD3]', text: 'text-[#1A9FD3]' },
            { label: 'Hisse Senedi Fonu', percent: 15, color: 'bg-indigo-500', text: 'text-indigo-400' },
            { label: 'Nakit Rezerv', percent: 10, color: 'bg-emerald-400', text: 'text-emerald-400' },
        ],
        holdings: [
            { symbol: 'ASELS', name: 'Aselsan Elektronik', type: 'HISSE', weight: 30, price: '₺64,20', change: '+3,10%', positive: true },
            { symbol: 'THYAO', name: 'Türk Hava Yolları', type: 'HISSE', weight: 25, price: '₺318,50', change: '+2,40%', positive: true },
            { symbol: 'TUPRS', name: 'Tüpraş Rafineri', type: 'HISSE', weight: 20, price: '₺168,70', change: '+1,85%', positive: true },
            { symbol: 'TLY', name: 'Tacirler Portföy Fon', type: 'FON', weight: 15, price: '₺12,40', change: '+2,60%', positive: true },
            { symbol: 'TRY', name: 'TL Nakit Bakiye', type: 'NAKIT', weight: 10, price: '₺1,00', change: '%0,00', positive: true },
        ],
        chartData: {
            '1A': [380, 385, 378, 395, 402, 398, 410, 405, 415, 412, 420, 426],
            '3A': [340, 355, 345, 368, 380, 372, 390, 385, 402, 410, 418, 426],
            '6M': [290, 310, 305, 330, 345, 340, 365, 380, 395, 405, 415, 426],
            '1Y': [230, 255, 270, 290, 315, 335, 360, 380, 395, 410, 420, 426],
            'TÜMÜ': [140, 175, 210, 245, 280, 310, 345, 375, 395, 410, 420, 426],
        },
    },
    {
        id: 'defensive',
        title: 'Defansif & Emtia Portföyü',
        shortTitle: 'Defansif & Altın',
        icon: '🛡️',
        badge: 'Enflasyon Koruması',
        totalValue: '684.500,00',
        totalProfit: '+164.200,00',
        totalReturnPercent: '+31,56%',
        dailyChange: '+2.150,00',
        dailyPercent: '+0,31%',
        isDailyPositive: true,
        allocations: [
            { label: 'Kıymetli Maden (Altın)', percent: 50, color: 'bg-amber-400', text: 'text-amber-400' },
            { label: 'Para Piyasası Fonu', percent: 30, color: 'bg-indigo-500', text: 'text-indigo-400' },
            { label: 'Döviz (USD/EUR)', percent: 20, color: 'bg-emerald-400', text: 'text-emerald-400' },
        ],
        holdings: [
            { symbol: 'ALTIN', name: 'Gram Altın', type: 'ALTIN', weight: 50, price: '₺6.787,00', change: '+0,80%', positive: true },
            { symbol: 'TI2', name: 'İş Para Piyasası Fonu', type: 'FON', weight: 30, price: '₺4,85', change: '+0,14%', positive: true },
            { symbol: 'USDTRY', name: 'Amerikan Doları', type: 'DOVIZ', weight: 20, price: '₺48,83', change: '+0,06%', positive: true },
        ],
        chartData: {
            '1A': [668, 670, 671, 673, 674, 676, 678, 680, 681, 682, 683, 684],
            '3A': [640, 645, 649, 653, 658, 662, 667, 671, 675, 679, 682, 684],
            '6M': [590, 600, 610, 622, 632, 642, 652, 660, 669, 676, 681, 684],
            '1Y': [510, 528, 545, 562, 580, 598, 615, 632, 650, 665, 678, 684],
            'TÜMÜ': [320, 360, 400, 440, 485, 530, 575, 615, 650, 670, 680, 684],
        },
    },
];

export default function PortfolioShowcase() {
    const { user } = useAuth();
    const [activePresetId, setActivePresetId] = useState<string>('balanced');
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3A');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const activePreset = useMemo(() => {
        return PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    }, [activePresetId]);

    const points = useMemo(() => {
        return activePreset.chartData[selectedPeriod] || activePreset.chartData['3A'];
    }, [activePreset, selectedPeriod]);

    // SVG Grafik Koordinatlarını Hesapla
    const chartPath = useMemo(() => {
        if (!points || points.length === 0) return { line: '', area: '', coords: [] };

        const width = 500;
        const height = 140;
        const padding = 12;

        const minVal = Math.min(...points);
        const maxVal = Math.max(...points);
        const range = maxVal - minVal || 1;

        const coords = points.map((val, idx) => {
            const x = (idx / (points.length - 1)) * (width - padding * 2) + padding;
            const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
            return { x, y, val };
        });

        // Bezier Eğrisi Oluşturma
        let line = `M ${coords[0].x},${coords[0].y}`;
        for (let i = 0; i < coords.length - 1; i++) {
            const curr = coords[i];
            const next = coords[i + 1];
            const mx = (curr.x + next.x) / 2;
            line += ` C ${mx},${curr.y} ${mx},${next.y} ${next.x},${next.y}`;
        }

        const area = `${line} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

        return { line, area, coords };
    }, [points]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-5xl mt-10 rounded-2xl border border-border/80 bg-[#0D1117]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-left flex flex-col"
        >
            {/* ═══════════════ ÜST BAR & SENARYO SEÇİCİ ═══════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-border/60 bg-[#0B0F15]/90 gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-wide">Yarmak Portföy Motoru</span>
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">• İnteraktif Simülasyon</span>
                </div>

                {/* Strateji / Senaryo Sekmeleri */}
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
                                <span>{p.icon}</span>
                                <span>{p.shortTitle}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════════ ANA GÖVDE: SOL GRAFİK + SAĞ VARLIKLAR ═══════════════ */}
            <div className="flex flex-col lg:flex-row items-stretch gap-6 p-5 sm:p-6 bg-[#0D1117]">
                
                {/* ─── SOL PANEL: PORTFÖY DEĞERİ, GRAFİK VE DAĞILIM ─── */}
                <div className="flex-1 flex flex-col justify-between bg-[#131924]/70 border border-border/50 rounded-xl p-5">
                    
                    {/* Bakiye & K/Z Başlığı */}
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
                                    ₺{activePreset.totalValue}
                                </span>
                                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <TrendingUp className="size-3.5" />
                                    {activePreset.totalReturnPercent}
                                </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                                <span>Bugün:</span>
                                <span className={activePreset.isDailyPositive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                    ₺{activePreset.dailyChange} ({activePreset.dailyPercent})
                                </span>
                            </div>
                        </div>

                        {/* Dönem Butonları: 1A, 3A, 6M, 1Y, TÜMÜ */}
                        <div className="flex items-center gap-1 bg-surface/60 p-1 rounded-lg border border-border/40 self-start sm:self-auto">
                            {(['1A', '3A', '6M', '1Y', 'TÜMÜ'] as Period[]).map((period) => (
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

                    {/* İnteraktif Portföy Getiri Grafiği (SVG) */}
                    <div className="relative w-full h-36 mt-4">
                        <svg
                            viewBox="0 0 500 140"
                            className="w-full h-full overflow-visible"
                            preserveAspectRatio="none"
                            onMouseLeave={() => setHoverIndex(null)}
                        >
                            <defs>
                                <linearGradient id="showcaseGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1A9FD3" stopOpacity="0.32" />
                                    <stop offset="100%" stopColor="#1A9FD3" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Dikey Kılavuz Çizgileri */}
                            {[100, 200, 300, 400].map((x) => (
                                <line
                                    key={x}
                                    x1={x}
                                    y1={0}
                                    x2={x}
                                    y2={140}
                                    stroke="rgba(255,255,255,0.04)"
                                    strokeDasharray="4 4"
                                />
                            ))}

                            {/* Dolgulu Alan & Eğri */}
                            <path d={chartPath.area} fill="url(#showcaseGrad)" />
                            <path
                                d={chartPath.line}
                                fill="none"
                                stroke="#1A9FD3"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />

                            {/* Hover Kılavuz Çizgisi ve Noktası */}
                            {hoverIndex !== null && chartPath.coords[hoverIndex] && (
                                <>
                                    <line
                                        x1={chartPath.coords[hoverIndex].x}
                                        y1={0}
                                        x2={chartPath.coords[hoverIndex].x}
                                        y2={140}
                                        stroke="#1A9FD3"
                                        strokeWidth="1.5"
                                        strokeDasharray="2 2"
                                    />
                                    <circle
                                        cx={chartPath.coords[hoverIndex].x}
                                        cy={chartPath.coords[hoverIndex].y}
                                        r="4.5"
                                        fill="#0D1117"
                                        stroke="#1A9FD3"
                                        strokeWidth="2.5"
                                    />
                                </>
                            )}

                            {/* Şeffaf Hover Tetikleyicileri */}
                            {chartPath.coords.map((coord, idx) => (
                                <rect
                                    key={idx}
                                    x={coord.x - 20}
                                    y={0}
                                    width={40}
                                    height={140}
                                    fill="transparent"
                                    className="cursor-crosshair"
                                    onMouseEnter={() => setHoverIndex(idx)}
                                />
                            ))}
                        </svg>

                        {/* Hover Bilgi Kartı (Tooltip) */}
                        {hoverIndex !== null && chartPath.coords[hoverIndex] && (
                            <div
                                className="absolute pointer-events-none -top-3 transform -translate-x-1/2 bg-[#090D14]/95 border border-primary/40 px-2.5 py-1 rounded shadow-lg text-[11px] font-mono text-white flex items-center gap-1.5"
                                style={{
                                    left: `${(chartPath.coords[hoverIndex].x / 500) * 100}%`,
                                }}
                            >
                                <span className="text-slate-400">₺{chartPath.coords[hoverIndex].val}K</span>
                                <span className="text-emerald-400 font-bold">▲</span>
                            </div>
                        )}
                    </div>

                    {/* Varlık Dağılımı Çubuğu (Allocation Bar) */}
                    <div className="mt-4 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                            <span className="font-medium flex items-center gap-1.5">
                                <Layers className="size-3 text-primary" /> Varlık Dağılımı
                            </span>
                            <span className="text-slate-400">100% Toplam Portföy</span>
                        </div>

                        {/* Renkli Çubuk */}
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-surface">
                            {activePreset.allocations.map((alloc, idx) => (
                                <div
                                    key={idx}
                                    style={{ width: `${alloc.percent}%` }}
                                    className={`${alloc.color} transition-all duration-300`}
                                    title={`${alloc.label}: %${alloc.percent}`}
                                />
                            ))}
                        </div>

                        {/* Dağılım Lejantı */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px]">
                            {activePreset.allocations.map((alloc, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                    <span className={`size-2 rounded-full ${alloc.color}`} />
                                    <span className="text-slate-300 font-medium">{alloc.label}</span>
                                    <span className="font-mono text-slate-400">%{alloc.percent}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── SAĞ PANEL: ÖRNEK VARLIKLAR & AKILLI CTA ─── */}
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

                        {/* Varlık Pozisyonları Listesi */}
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
                                                    %{h.weight}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
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

                    {/* Akıllı Oturum Duyarlı CTA */}
                    <div className="pt-2">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition shadow-lg shadow-primary/20 cursor-pointer"
                            >
                                <span>Portföyüme Git</span>
                                <ArrowRight className="size-3.5" />
                            </Link>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                <Link
                                    href="/register"
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition shadow-lg shadow-primary/20 cursor-pointer"
                                >
                                    <span>Kendi Portföyünü Oluştur</span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                                <span className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                                    <CheckCircle2 className="size-3 text-emerald-400" /> Ücretsiz • BIST & TEFAS anlık takip
                                </span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </motion.div>
    );
}
