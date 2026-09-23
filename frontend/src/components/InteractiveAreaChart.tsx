'use client';

import React, { useState, useMemo, useId, useCallback } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    CartesianGrid,
    Brush,
} from 'recharts';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export interface ChartPeriod {
    id: string; // '1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'
    label: string; // '1G', '1H', etc.
    changePercent?: number | null;
}

export interface ChartDataPoint {
    date: string;
    value?: number;
    price?: number;
    raw?: number;
    rawDate?: Date | string;
    [key: string]: number | string | Date | undefined;
}

export interface InteractiveAreaChartProps {
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    data: ChartDataPoint[];
    dataKey?: string; // default 'value'
    dateKey?: string; // default 'date'
    periods?: ChartPeriod[];
    activePeriod: string;
    onPeriodChange: (periodId: string) => void;
    currencySymbol?: string;
    currency?: 'TRY' | 'USD' | string;
    valueFormatter?: (val: number) => string;
    showBrush?: boolean;
    showStats?: boolean;
    isLoading?: boolean;
    loadingMessage?: string;
    emptyMessage?: string;
    height?: number;
    colorMode?: 'dynamic' | 'cyan' | 'indigo' | 'emerald';
    onBrushChange?: (e: { startIndex?: number; endIndex?: number }) => void;
    headerExtra?: React.ReactNode;
}

const DEFAULT_PERIODS: ChartPeriod[] = [
    { id: '1D', label: '1G' },
    { id: '1W', label: '1H' },
    { id: '1M', label: '1A' },
    { id: '3M', label: '3A' },
    { id: '6M', label: '6A' },
    { id: 'YTD', label: 'YBB' },
    { id: '1Y', label: '1Y' },
    { id: '3Y', label: '3Y' },
    { id: 'ALL', label: 'Tümü' },
];

export const InteractiveAreaChart: React.FC<InteractiveAreaChartProps> = React.memo(({
    title = 'Portföy Değer Gelişimi',
    subtitle,
    icon,
    data,
    dataKey = 'value',
    dateKey = 'date',
    periods = DEFAULT_PERIODS,
    activePeriod,
    onPeriodChange,
    currencySymbol = '₺',
    currency = 'TRY',
    valueFormatter,
    showBrush = true,
    showStats = true,
    isLoading = false,
    loadingMessage = 'Grafik verileri yükleniyor...',
    emptyMessage = 'Seçilen aralıkta grafik verisi bulunamadı.',
    height = 340,
    colorMode = 'dynamic',
    onBrushChange,
    headerExtra,
}) => {
    const rawGradientId = useId();
    const gradientId = `chartGrad_${rawGradientId.replace(/:/g, '_')}`;

    // Brush ile seçilen aralık (indeksler)
    const [brushRange, setBrushRange] = useState<{ start?: number; end?: number }>({});

    // Aktif periyot değiştiğinde brush aralığını sıfırla
    React.useEffect(() => {
        setBrushRange({});
    }, [activePeriod]);

    // Veri noktalarından sayısal değeri alma
    const getVal = useCallback((item: ChartDataPoint | undefined): number => {
        if (!item) return 0;
        if (typeof item[dataKey] === 'number') return item[dataKey];
        if (typeof item.value === 'number') return item.value;
        if (typeof item.price === 'number') return item.price;
        if (typeof item.raw === 'number') return item.raw;
        const parsed = parseFloat(String(item[dataKey] || item.value || item.price || 0));
        return isNaN(parsed) ? 0 : parsed;
    }, [dataKey]);

    // Görünür veri dilimi (Brush hareket ettiğinde filtrelenen)
    const visibleData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const start = brushRange.start !== undefined ? brushRange.start : 0;
        const end = brushRange.end !== undefined ? brushRange.end : data.length - 1;
        return data.slice(Math.max(0, start), Math.min(data.length, end + 1));
    }, [data, brushRange]);

    // Zirve (Max), Dip (Min), İlk ve Son Değer
    const { minVal, maxVal, firstVal, lastVal, periodReturn } = useMemo(() => {
        if (!visibleData || visibleData.length === 0) {
            return { minVal: 0, maxVal: 0, firstVal: 0, lastVal: 0, periodReturn: 0 };
        }
        let min = getVal(visibleData[0]);
        let max = min;
        for (const pt of visibleData) {
            const v = getVal(pt);
            if (v < min) min = v;
            if (v > max) max = v;
        }
        const first = getVal(visibleData[0]);
        const last = getVal(visibleData[visibleData.length - 1]);
        const ret = first > 0 ? ((last - first) / first) * 100 : 0;
        return { minVal: min, maxVal: max, firstVal: first, lastVal: last, periodReturn: ret };
    }, [visibleData, getVal]);

    // Dinamik renk belirleme
    const { strokeColor, fillColor } = useMemo(() => {
        if (colorMode === 'emerald') {
            return { strokeColor: '#10b981', fillColor: '#10b981' };
        }
        if (colorMode === 'cyan' || colorMode === 'indigo') {
            return { strokeColor: '#1A9FD3', fillColor: '#1A9FD3' };
        }
        // Dynamic mode: Getiriye göre yeşil ya da kırmızı
        if (periodReturn >= 0) {
            return { strokeColor: '#10b981', fillColor: '#10b981' }; // Yeşil: Kâr
        }
        return { strokeColor: '#f43f5e', fillColor: '#f43f5e' }; // Kırmızı: Zarar
    }, [colorMode, periodReturn]);

    // Standart değer biçimlendirici
    const defaultFormat = useCallback((val: number): string => {
        if (valueFormatter) return valueFormatter(val);
        const prefix = currencySymbol ? `${currencySymbol} ` : '';
        return `${prefix}${val.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }, [currencySymbol, valueFormatter]);

    // Y Ekseni kompakt biçimlendirici (12.5K, 1.2M vb.) — Kuruş altı fon fiyatlarını (0.0125 TL) hassas destekler
    const yAxisFormatter = useCallback((val: number): string => {
        if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
        if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
        if (val >= 100) return val.toFixed(0);
        if (val >= 1) return val.toFixed(2);
        if (val >= 0.01) return val.toFixed(4);
        return val.toFixed(6);
    }, []);

    // Brush değişim yöneticisi
    const handleInternalBrushChange = (e: any) => {
        if (e && e.startIndex !== undefined && e.endIndex !== undefined) {
            setBrushRange({ start: e.startIndex, end: e.endIndex });
            if (onBrushChange) onBrushChange(e);
        }
    };

    const currentStartIndex = brushRange.start !== undefined ? brushRange.start : 0;
    const currentEndIndex = brushRange.end !== undefined ? brushRange.end : (data && data.length > 0 ? data.length - 1 : 0);
    const startDateLabel = data && data.length > 0 && data[currentStartIndex] ? String(data[currentStartIndex][dateKey] || '') : '';
    const endDateLabel = data && data.length > 0 && data[currentEndIndex] ? String(data[currentEndIndex][dateKey] || '') : '';

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col w-full transition-all">
            {/* 1. ÜST BAŞLIK VE PERİYOT SEÇİCİ */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 gap-3 border-b border-slate-800/80">
                <div className="flex items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            {icon || <Activity className="w-5 h-5 text-[#1A9FD3] shrink-0" />}
                            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                {title}
                            </h3>
                        </div>
                        {subtitle && (
                            <p className="text-xs text-slate-400 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Periyot Butonları (Pills Bar) */}
                <div className="flex items-center gap-1.5 self-start xl:self-auto max-w-full">
                    <div className="flex bg-slate-800/90 rounded-xl p-1 border border-slate-700/60 overflow-x-auto no-scrollbar touch-pan-x max-w-full gap-1">
                        {periods.map(p => {
                            const isActive = activePeriod === p.id;
                            const hasChange = p.changePercent !== undefined && p.changePercent !== null;
                            const changeVal = p.changePercent || 0;

                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => onPeriodChange(p.id)}
                                    className={`group/pill flex flex-col items-center justify-center px-2.5 sm:px-3 py-1.5 min-w-[42px] sm:min-w-[48px] text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                                        isActive
                                            ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold shadow-sm shadow-[#1A9FD3]/20'
                                            : 'text-slate-300 hover:text-[#1A9FD3] hover:bg-[#1A9FD3]/15'
                                    }`}
                                >
                                    <span className={`leading-tight ${isActive ? 'text-white font-bold' : 'group-hover/pill:text-[#1A9FD3]'}`}>
                                        {p.label}
                                    </span>
                                    <span
                                        className={`text-[11px] font-bold mt-0.5 leading-tight font-mono tabular-nums transition-colors ${
                                            hasChange
                                                ? changeVal > 0
                                                    ? isActive ? 'text-emerald-300 font-bold' : 'text-emerald-400'
                                                    : changeVal < 0
                                                    ? isActive ? 'text-rose-300 font-bold' : 'text-rose-400'
                                                    : isActive ? 'text-white font-bold' : 'text-slate-400'
                                                : 'opacity-0 select-none'
                                        }`}
                                    >
                                        {hasChange ? `${changeVal > 0 ? '+' : ''}${changeVal.toFixed(2)}%` : '-'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {headerExtra}
                </div>
            </div>

            {/* 2. DÖNEM VE GRAFİK İSTATİSTİKLERİ (Seçili Getiri, Zirve, Dip) */}
            {showStats && (
                <div className="flex flex-wrap items-center justify-between py-3 gap-2 text-xs">
                    {/* Seçili Periyot Getirisi ve Tarih Aralığı */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400 font-medium">Seçili Aralık:</span>
                        {startDateLabel && endDateLabel && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 font-mono text-[11px] text-slate-300">
                                {startDateLabel} — {endDateLabel}
                            </span>
                        )}
                        <span
                            className={`px-2.5 py-1 rounded-lg font-bold flex items-center border ${
                                periodReturn >= 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                        >
                            {periodReturn >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                            ) : (
                                <TrendingDown className="w-3.5 h-3.5 mr-1" />
                            )}
                            {periodReturn >= 0 ? '+' : ''}
                            {periodReturn.toFixed(2)}%
                        </span>
                    </div>

                    {/* Zirve ve Dip Değerleri */}
                    <div className="flex items-center gap-3">
                        {minVal > 0 && maxVal > 0 && (
                            <>
                                <div className="flex items-center gap-1 text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40">
                                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                                    <span className="text-slate-400">Dip:</span>
                                    <span className="font-semibold text-slate-200">{defaultFormat(minVal)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-slate-400">Zirve:</span>
                                    <span className="font-semibold text-slate-200">{defaultFormat(maxVal)}</span>
                                </div>
                            </>
                        )}
                        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                            {currency === 'USD' ? 'Değerler Dolar ($) bazındadır' : 'Değerler TL (₺) bazındadır'}
                        </span>
                    </div>
                </div>
            )}

            {/* 3. GRAFİK VE ZAMAN KAYDIRICI (BRUSH) ALANI */}
            <div className="w-full relative" style={{ minHeight: `${height}px`, height: `${height}px` }}>
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs rounded-xl">
                        <LoadingSpinner fullScreen={false} message={loadingMessage} />
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-center px-4">
                        <Activity className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium text-slate-400">{emptyMessage}</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={fillColor} stopOpacity={0.12} />
                                    <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#334155"
                                opacity={0.35}
                                vertical={false}
                            />

                            <XAxis
                                dataKey={dateKey}
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={25}
                            />

                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                domain={minVal > 0 && maxVal > 0 && minVal === maxVal ? [minVal * 0.98, maxVal * 1.02] : ['auto', 'auto']}
                                tickFormatter={yAxisFormatter}
                            />

                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    borderRadius: '0.75rem',
                                    color: '#fff',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                }}
                                formatter={(val: any) => [defaultFormat(Number(val)), title || 'Değer']}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
                            />

                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={strokeColor}
                                strokeWidth={2.2}
                                fillOpacity={1}
                                fill={`url(#${gradientId})`}
                                activeDot={{ r: 5, fill: strokeColor, stroke: '#0f172a', strokeWidth: 2 }}
                            />

                            {/* ZAMAN KAYDIRICI (BRUSH) - HER PERİYOT İÇİN AYARLAMA ÇUBUĞU */}
                            {showBrush && data.length > 1 && (
                                <Brush
                                    dataKey={dateKey}
                                    height={24}
                                    stroke={strokeColor}
                                    fill="#1e293b"
                                    travellerWidth={8}
                                    onChange={handleInternalBrushChange}
                                    tickFormatter={() => ''}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* 4. BRUSH BAŞLANGIÇ - BİTİŞ GÖSTERGE ÇUBUĞU */}
            {showBrush && data && data.length > 1 && (
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 px-1 text-xs">
                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-200 shadow-xs">
                        <span className="text-emerald-400 font-bold">Başlangıç:</span>
                        <span>{startDateLabel || '-'}</span>
                    </div>

                    <span className="text-[11px] text-slate-500 hidden sm:inline select-none">
                        Aralığı değiştirmek için çubuğun kenarlarını kaydırın
                    </span>

                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-200 shadow-xs">
                        <span className="text-emerald-400 font-bold">Bitiş:</span>
                        <span>{endDateLabel || '-'}</span>
                    </div>
                </div>
            )}
        </div>
    );
});

InteractiveAreaChart.displayName = 'InteractiveAreaChart';
