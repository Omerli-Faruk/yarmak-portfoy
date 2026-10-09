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
import { CHART_PERIODS } from '@/lib/periodUtils';
import { formatSignedPercent } from '@/lib/formatters';

export interface ChartPeriod {
    id: string;    // '1D', '1W', ... 'ALL'
    label: string; // ekranda görünen kısa ad: '1G', '1H', ...
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
    data: ChartDataPoint[];
    dataKey?: string; // varsayılan 'value'
    dateKey?: string; // varsayılan 'date'
    periods?: ChartPeriod[];
    activePeriod: string;
    onPeriodChange: (periodId: string) => void;
    currencySymbol?: string;
    currency?: 'TRY' | 'USD' | string;
    valueFormatter?: (val: number) => string;
    showBrush?: boolean;
    showStats?: boolean;
    isLoading?: boolean;
    emptyMessage?: string;
}

const CHART_HEIGHT = 340;
const UP_COLOR = '#10b981';
const DOWN_COLOR = '#f43f5e';

export const InteractiveAreaChart: React.FC<InteractiveAreaChartProps> = React.memo(({
    title = 'Portföy Değer Gelişimi',
    subtitle,
    data,
    dataKey = 'value',
    dateKey = 'date',
    periods = CHART_PERIODS,
    activePeriod,
    onPeriodChange,
    currencySymbol = '₺',
    currency = 'TRY',
    valueFormatter,
    showBrush = true,
    showStats = true,
    isLoading = false,
    emptyMessage = 'Seçilen aralıkta grafik verisi bulunamadı.',
}) => {
    const rawGradientId = useId();
    const gradientId = `chartGrad_${rawGradientId.replace(/:/g, '_')}`;

    // Kaydırıcıyla seçilen aralığın başlangıç ve bitiş indeksleri
    const [brushRange, setBrushRange] = useState<{ start?: number; end?: number }>({});

    // Periyot değişince seçili aralık sıfırlanır
    React.useEffect(() => {
        setBrushRange({});
    }, [activePeriod]);

    // Veri noktasının sayısal değeri
    const getVal = useCallback((item: ChartDataPoint | undefined): number => {
        if (!item) return 0;
        if (typeof item[dataKey] === 'number') return item[dataKey];
        if (typeof item.value === 'number') return item.value;
        if (typeof item.price === 'number') return item.price;
        if (typeof item.raw === 'number') return item.raw;
        const parsed = parseFloat(String(item[dataKey] || item.value || item.price || 0));
        return isNaN(parsed) ? 0 : parsed;
    }, [dataKey]);

    // Kaydırıcıyla seçilen aralıkta kalan noktalar
    const visibleData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const start = brushRange.start !== undefined ? brushRange.start : 0;
        const end = brushRange.end !== undefined ? brushRange.end : data.length - 1;
        return data.slice(Math.max(0, start), Math.min(data.length, end + 1));
    }, [data, brushRange]);

    // Görünen aralığın en düşük ve en yüksek değeri, ilk ve son nokta arasındaki yüzde değişim
    const { minVal, maxVal, periodReturn } = useMemo(() => {
        if (!visibleData || visibleData.length === 0) {
            return { minVal: 0, maxVal: 0, periodReturn: 0 };
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
        return { minVal: min, maxVal: max, periodReturn: ret };
    }, [visibleData, getVal]);

    // Kaydırıcı daraltıldı mı (başı ya da sonu kenardan içeri çekildi mi)
    const isCustomRangeSelected = useMemo(() => {
        if (!data || data.length === 0) return false;
        const isStartMoved = brushRange.start !== undefined && brushRange.start > 0;
        const isEndMoved = brushRange.end !== undefined && brushRange.end < data.length - 1;
        return isStartMoved || isEndMoved;
    }, [brushRange, data]);

    const activePeriodObj = useMemo(() => {
        return periods.find(p => p.id === activePeriod);
    }, [periods, activePeriod]);

    // Yüzde ve çizgi rengi görünen ilk ve son noktaya göre belirlenir, düşen eğri yeşil görünmez
    const isUp = periodReturn >= 0;
    const lineColor = isUp ? UP_COLOR : DOWN_COLOR;

    // valueFormatter verilmezse kullanılan biçim
    const defaultFormat = useCallback((val: number): string => {
        if (valueFormatter) return valueFormatter(val);
        const prefix = currencySymbol ? `${currencySymbol} ` : '';
        return `${prefix}${val.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }, [currencySymbol, valueFormatter]);

    // Y ekseni etiketleri. Binlerde kısaltma yapmıyoruz: dar aralıkta (ör. 6.600-6.700 altın) her etiket "7K" oluyordu.
    // Kuruşun altındaki fon fiyatlarında daha çok basamak gösterilir.
    const yAxisFormatter = useCallback((val: number): string => {
        if (val >= 1e6) return `${(val / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}M`;
        if (val >= 1e3) return val.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        if (val >= 100) return val.toFixed(0);
        if (val >= 1) return val.toFixed(2);
        if (val >= 0.01) return val.toFixed(4);
        return val.toFixed(6);
    }, []);

    // Kaydırıcı sürüklenirken state güncellemesini kare başına bire indirmek için requestAnimationFrame kullanılır
    const rafRef = React.useRef<number | null>(null);
    const lastRangeRef = React.useRef<{ start?: number; end?: number }>({});

    React.useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const handleInternalBrushChange = useCallback((e: { startIndex?: number; endIndex?: number } | null) => {
        if (!e || e.startIndex === undefined || e.endIndex === undefined) return;
        if (e.startIndex === lastRangeRef.current.start && e.endIndex === lastRangeRef.current.end) return;
        lastRangeRef.current = { start: e.startIndex, end: e.endIndex };

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
            setBrushRange({ start: e.startIndex, end: e.endIndex });
            rafRef.current = null;
        });
    }, []);

    const currentStartIndex = brushRange.start !== undefined ? brushRange.start : 0;
    const currentEndIndex = brushRange.end !== undefined ? brushRange.end : (data && data.length > 0 ? data.length - 1 : 0);
    const startDateLabel = data && data.length > 0 && data[currentStartIndex] ? String(data[currentStartIndex][dateKey] || '') : '';
    const endDateLabel = data && data.length > 0 && data[currentEndIndex] ? String(data[currentEndIndex][dateKey] || '') : '';

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col w-full transition-all">
            {/* Başlık ve periyot seçici */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 gap-3 border-b border-slate-800/80">
                <div className="flex items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <Activity className="w-5 h-5 text-[#1A9FD3] shrink-0" />
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

                {/* Periyot düğmeleri */}
                <div className="flex items-center gap-1.5 self-start xl:self-auto max-w-full">
                    <div className="flex bg-slate-800/90 rounded-xl p-1 border border-slate-700/60 overflow-x-auto no-scrollbar touch-pan-x max-w-full gap-1">
                        {periods.map(p => {
                            const isActive = activePeriod === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => onPeriodChange(p.id)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                                        isActive
                                            ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20 font-bold'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50 font-medium'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Görünen aralığın değişimi, en düşük ve en yüksek değeri */}
            {showStats && (
                <div className="flex items-center justify-between py-2.5 gap-2 text-xs min-h-[46px] overflow-x-auto no-scrollbar">
                    {/* Değişim ve tarih aralığı */}
                    <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                        <span className="text-slate-400 font-medium">
                            {isCustomRangeSelected ? 'Seçili Aralık:' : `${activePeriodObj?.label || activePeriod} Getirisi:`}
                        </span>
                        {startDateLabel && endDateLabel && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 font-mono text-[11px] text-slate-300">
                                {startDateLabel} — {endDateLabel}
                            </span>
                        )}
                        <span
                            title={!isCustomRangeSelected ? 'Dönem başındaki değer ile son değer arasındaki değişim' : 'Seçilen aralığın ilk ve son değeri arasındaki değişim'}
                            className={`px-2.5 py-1 rounded-lg font-bold flex items-center border ${
                                isUp
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                        >
                            {isUp ? (
                                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                            ) : (
                                <TrendingDown className="w-3.5 h-3.5 mr-1" />
                            )}
                            {formatSignedPercent(periodReturn)}
                        </span>
                    </div>

                    {/* Dip ve zirve */}
                    <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {minVal > 0 && maxVal > 0 && (
                            <>
                                <div className="flex items-center gap-1 text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40">
                                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                                    <span className="text-slate-400">Dip:</span>
                                    <span className="font-semibold text-slate-200 tabular-nums">{defaultFormat(minVal)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-slate-400">Zirve:</span>
                                    <span className="font-semibold text-slate-200 tabular-nums">{defaultFormat(maxVal)}</span>
                                </div>
                            </>
                        )}
                        <span className="text-[11px] text-slate-500 font-mono hidden xl:inline">
                            {currency === 'USD' ? '($)' : currencySymbol ? `(${currencySymbol})` : null}
                        </span>
                    </div>
                </div>
            )}

            {/* Grafik ve zaman kaydırıcı */}
            <div className="w-full relative" style={{ minHeight: CHART_HEIGHT, height: CHART_HEIGHT }}>
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs rounded-xl">
                        <LoadingSpinner fullScreen={false} message="Grafik verileri yükleniyor..." />
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-center px-4">
                        <Activity className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium text-slate-400">{emptyMessage}</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 10, left: -15, bottom: showBrush ? 10 : 0 }}
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.12} />
                                    <stop offset="95%" stopColor={lineColor} stopOpacity={0.0} />
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
                                height={24}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={35}
                            />

                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                width={56}
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
                                formatter={(val) => [defaultFormat(Number(val)), title || 'Değer']}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
                            />

                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={lineColor}
                                strokeWidth={2.2}
                                fillOpacity={1}
                                fill={`url(#${gradientId})`}
                                activeDot={{ r: 5, fill: lineColor, stroke: '#0f172a', strokeWidth: 2 }}
                                isAnimationActive={false}
                            />

                            {/* Zaman kaydırıcı: periyot içinde aralığı daraltmak için */}
                            {showBrush && data.length > 1 && (
                                <Brush
                                    dataKey={dateKey}
                                    height={28}
                                    stroke={lineColor}
                                    fill="#1e293b"
                                    travellerWidth={10}
                                    onChange={handleInternalBrushChange}
                                    tickFormatter={() => ''}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Seçili aralığın başlangıç ve bitiş tarihi */}
            {showBrush && data && data.length > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-800/80 px-1 text-xs min-h-[44px] whitespace-nowrap overflow-hidden">
                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-200 shadow-xs shrink-0">
                        <span className="text-emerald-400 font-bold">Başlangıç:</span>
                        <span>{startDateLabel || '-'}</span>
                    </div>

                    <span className="text-[11px] text-slate-500 hidden md:inline select-none truncate px-2 text-center">
                        Aralığı değiştirmek için çubuğun kenarlarını kaydırın
                    </span>

                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-200 shadow-xs shrink-0">
                        <span className="text-emerald-400 font-bold">Bitiş:</span>
                        <span>{endDateLabel || '-'}</span>
                    </div>
                </div>
            )}
        </div>
    );
});

InteractiveAreaChart.displayName = 'InteractiveAreaChart';
