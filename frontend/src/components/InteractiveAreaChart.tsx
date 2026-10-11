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
    ReferenceLine,
} from 'recharts';
import { Activity } from 'lucide-react';
import Card from '@/components/ui/Card';
import ChangePill from '@/components/ui/ChangePill';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { CHART_PERIODS } from '@/lib/periodUtils';

export interface ChartPeriod {
    id: string;    // '1D', '1W', ... '5Y'
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

// Dönem K/Z'si: tutar grafikteki para biriminde, yüzde maliyete göre
export interface ChartPeriodResult {
    amount: number;
    pct: number;
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
    // 'auto': çizgi dönem yükseliyorsa yeşil, düşüyorsa kırmızı. 'primary': her zaman marka mavisi (portföy grafiği için)
    lineTone?: 'auto' | 'primary';
    height?: number; // grafik alanının yüksekliği (px)
    // true: panel çerçevesi ve başlık çubuğu çizilmez (Hero/Section içinde). Başlığı Section verir;
    // dönem seçici istatistik satırının sağında durur. title yine ipucu etiketi olarak kullanılır.
    frameless?: boolean;
    // Verilirse ilk/son noktadan hesaplanan getiri yerine "{dönem} K/Z: +X ₺ (+%Y)" yazılır (portföy grafiği).
    periodResult?: ChartPeriodResult;
    // Kaydırıcıyla daraltılmış aralığın K/Z'si; verilmezse aralıkta ilk/son nokta yüzdesi gösterilir
    rangeResultFor?: (first: ChartDataPoint, last: ChartDataPoint) => ChartPeriodResult | null;
    // Dönem değişiminin tutarı için işaretli biçim; verilmezse değer biçimine işaret eklenir
    changeFormatter?: (val: number) => string;
    // true: değerler kâr/zarar gibi işaretli ve sıfırın altına inebilir. İpucu ve uç değerler "+/−" ile yazılır,
    // eksen sıfırı kesiyorsa ince bir sıfır çizgisi çizilir.
    signed?: boolean;
    // Uç değer etiketleri; varsayılan "Dip" / "Zirve"
    minLabel?: string;
    maxLabel?: string;
    // Verilirse kesikli yatay referans çizgisi çizilir (ör. 1G'de önceki kapanış). Dönem değişimi ilk nokta yerine
    // buna göre ölçülür, eksen bu değeri de kapsar. Kaydırıcıyla daraltılan aralıkta yine ilk nokta esas alınır.
    referenceValue?: number | null;
    referenceLabel?: string;
    className?: string;
}

const DEFAULT_CHART_HEIGHT = 300;
// Renkler temaya göre globals.css değişkenlerinden gelir
const UP_COLOR = 'var(--profit)';
const DOWN_COLOR = 'var(--loss)';
// Eksen yazısı en az 12px, ipucu 14px (v3.1 okunabilirlik)
const AXIS_TICK = { fill: 'var(--chart-axis)', fontFamily: 'var(--font-mono)', fontSize: 12 };

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
    lineTone = 'auto',
    height = DEFAULT_CHART_HEIGHT,
    frameless = false,
    periodResult,
    rangeResultFor,
    changeFormatter,
    signed = false,
    minLabel = 'Dip',
    maxLabel = 'Zirve',
    referenceValue,
    referenceLabel = 'Önceki kapanış',
    className,
}) => {
    const rawGradientId = useId();
    const gradientId = `chartGrad_${rawGradientId.replace(/:/g, '_')}`;

    // Kaydırıcıyla seçilen aralığın başlangıç ve bitiş indeksleri
    const [brushRange, setBrushRange] = useState<{ start?: number; end?: number }>({});

    // Periyot değişince seçili aralık sıfırlanır
    // (efekt yerine render sırasında: önceki dönem state'te tutulur)
    const [prevPeriod, setPrevPeriod] = useState(activePeriod);
    if (activePeriod !== prevPeriod) {
        setPrevPeriod(activePeriod);
        setBrushRange({});
    }

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

    // Kaydırıcı daraltıldı mı (başı ya da sonu kenardan içeri çekildi mi)
    const isCustomRangeSelected = useMemo(() => {
        if (!data || data.length === 0) return false;
        const isStartMoved = brushRange.start !== undefined && brushRange.start > 0;
        const isEndMoved = brushRange.end !== undefined && brushRange.end < data.length - 1;
        return isStartMoved || isEndMoved;
    }, [brushRange, data]);

    // Referans çizgisi (ör. önceki kapanış); geçersizse yok sayılır
    const refValue = typeof referenceValue === 'number' && Number.isFinite(referenceValue) ? referenceValue : null;

    // Görünen aralığın en düşük ve en yüksek değeri, başlangıç ile son nokta arasındaki yüzde değişim.
    // Başlangıç referans varsa referans (daraltılmış aralıkta ilk nokta), yoksa ilk nokta.
    const { minVal, maxVal, periodReturn, periodChange } = useMemo(() => {
        if (!visibleData || visibleData.length === 0) {
            return { minVal: 0, maxVal: 0, periodReturn: 0, periodChange: 0 };
        }
        let min = getVal(visibleData[0]);
        let max = min;
        for (const pt of visibleData) {
            const v = getVal(pt);
            if (v < min) min = v;
            if (v > max) max = v;
        }
        const first = refValue !== null && !isCustomRangeSelected ? refValue : getVal(visibleData[0]);
        const last = getVal(visibleData[visibleData.length - 1]);
        const ret = first > 0 ? ((last - first) / first) * 100 : 0;
        return { minVal: min, maxVal: max, periodReturn: ret, periodChange: last - first };
    }, [visibleData, getVal, refValue, isCustomRangeSelected]);

    const activePeriodObj = useMemo(() => {
        return periods.find(p => p.id === activePeriod);
    }, [periods, activePeriod]);

    // Dönem K/Z'si verildiyse o; kaydırıcı daraltıldıysa aralığın K/Z'si (hesaplanabiliyorsa)
    const result = useMemo<ChartPeriodResult | null>(() => {
        if (visibleData.length === 0) return null;
        if (!isCustomRangeSelected) return periodResult ?? null;
        if (!rangeResultFor || visibleData.length < 2) return null;
        return rangeResultFor(visibleData[0], visibleData[visibleData.length - 1]);
    }, [visibleData, isCustomRangeSelected, periodResult, rangeResultFor]);

    // Çizgi rengi görünen ilk ve son noktanın farkına göre: düşen eğri yeşil görünmez.
    // Yüzdeye değil farka bakıyoruz; K/Z eğrisi sıfırdan ya da eksiden başlayabilir.
    const isUp = periodChange >= 0;
    const lineColor = lineTone === 'primary' ? 'var(--primary)' : isUp ? UP_COLOR : DOWN_COLOR;

    // valueFormatter verilmezse kullanılan biçim: formatters.ts ile aynı, "1.234,56 ₺" / "$1.234,56"
    const defaultFormat = useCallback((val: number): string => {
        if (valueFormatter) return valueFormatter(val);
        const number = val.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        if (!currencySymbol) return number;
        return currencySymbol === '₺' ? `${number} ₺` : `${currencySymbol}${number}`;
    }, [currencySymbol, valueFormatter]);

    // İşaretli tutar: "+5.000,25 ₺", "−1.200,00 ₺"; kuruştan küçük farkta işaret yok
    const signedFormat = useCallback((val: number): string => {
        const sign = val >= 0.005 ? '+' : val <= -0.005 ? '−' : '';
        return `${sign}${defaultFormat(Math.abs(val))}`;
    }, [defaultFormat]);

    // Uç değerler ve ipucu: işaretli grafikte "+1.234,56 ₺" / "−1.234,56 ₺"
    const pointFormat = signed ? signedFormat : defaultFormat;

    // Y ekseni etiketleri. Binlerde kısaltma yapmıyoruz: dar aralıkta (ör. 6.600-6.700 altın) her etiket "7K" oluyordu.
    // Kuruşun altındaki fon fiyatlarında daha çok basamak gösterilir. Eksi değerler (K/Z) aynı kuralla, başına "−".
    const yAxisFormatter = useCallback((val: number): string => {
        const abs = Math.abs(val);
        if (abs === 0) return '0';
        const sign = val < 0 ? '−' : '';
        if (abs >= 1e6) return `${sign}${(abs / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}M`;
        if (abs >= 1e3) return sign + abs.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        if (abs >= 100) return sign + abs.toFixed(0);
        if (abs >= 1) return sign + abs.toFixed(2);
        if (abs >= 0.01) return sign + abs.toFixed(4);
        return sign + abs.toFixed(6);
    }, []);

    // Düz çizgide eksen aralığı açılsın diye biraz pay; K/Z'de değer sıfır ya da eksi olabilir.
    // Referans çizgisi eksene ReferenceLine'ın extendDomain ayarıyla katılır.
    const yDomain = useMemo<[number, number] | ['auto', 'auto']>(() => {
        if (minVal !== maxVal || (refValue !== null && refValue !== minVal)) return ['auto', 'auto'];
        if (minVal > 0) return [minVal * 0.98, maxVal * 1.02];
        if (!signed) return ['auto', 'auto'];
        const pad = Math.max(Math.abs(minVal) * 0.02, 1);
        return [minVal - pad, maxVal + pad];
    }, [minVal, maxVal, signed, refValue]);

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

    const periodOptions = periods.map(p => ({ value: p.id, label: p.label }));
    const unitLabel = currency === 'USD' ? '$' : currencySymbol || null;

    const periodSelector = (
        <SegmentedControl
            size="sm"
            mono
            ariaLabel="Grafik dönemi"
            options={periodOptions}
            value={activePeriod}
            onChange={onPeriodChange}
            className="flex-wrap sm:flex-nowrap"
        />
    );

    return (
        <ChartShell frameless={frameless} className={className}>
            {frameless ? (
                // Çerçevesiz: başlığı Section/Hero verir; burada yalnızca dönem seçici sağda durur
                !showStats && <div className="flex justify-end pb-2">{periodSelector}</div>
            ) : (
                // Başlık çubuğu: solda başlık, sağda dönem sekmeleri
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 min-h-12 px-3 sm:px-4 py-1.5 border-b border-border">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h3 className="text-base font-medium text-fg truncate">{title}</h3>
                        {subtitle && <span className="text-xs text-fg-subtle truncate">{subtitle}</span>}
                    </div>
                    {periodSelector}
                </div>
            )}

            {/* Görünen aralığın değişimi, en düşük ve en yüksek değeri (çerçevesizde dönem seçici de bu satırda) */}
            {showStats && (
                <div
                    className={cn(
                        'flex flex-wrap items-center text-13',
                        frameless ? 'gap-x-6 gap-y-2 pb-2' : 'justify-between gap-x-4 gap-y-1 px-3 sm:px-4 pt-2.5',
                    )}
                >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {result ? (
                            <>
                                <span className="text-fg-subtle">
                                    {isCustomRangeSelected ? 'Seçili aralık K/Z:' : `${activePeriodObj?.label || activePeriod} K/Z:`}
                                </span>
                                <ChangePill
                                    value={result.pct}
                                    amount={signedFormat(result.amount)}
                                    size="md"
                                    title="Alım ve satımlar hariç, dönem içindeki kâr/zarar; yüzde maliyete göre"
                                />
                            </>
                        ) : visibleData.length > 0 && !isLoading && (
                            <>
                                <span className="text-fg-subtle">
                                    {isCustomRangeSelected ? 'Seçili aralık:' : `${activePeriodObj?.label || activePeriod} getirisi:`}
                                </span>
                                {/* Önce tutar, parantezde yüzde (portföy grafiğindeki K/Z satırı gibi) */}
                                <ChangePill
                                    value={periodReturn}
                                    amount={(changeFormatter ?? signedFormat)(periodChange)}
                                    size="md"
                                    title={
                                        isCustomRangeSelected ? 'Seçilen aralığın ilk ve son değeri arasındaki değişim'
                                            : refValue !== null ? `${referenceLabel} ile son değer arasındaki değişim`
                                                : 'Dönem başındaki değer ile son değer arasındaki değişim'
                                    }
                                />
                            </>
                        )}
                        {/* Kaydırıcı varken tarih aralığı grafiğin altında yazar; burada yinelenmez */}
                        {!showBrush && startDateLabel && endDateLabel && (
                            <span className="font-mono text-xs text-fg-subtle whitespace-nowrap">
                                {startDateLabel} – {endDateLabel}
                            </span>
                        )}
                    </div>

                    {/* Dip ve zirve (K/Z grafiğinde en düşük/en yüksek K/Z, eksi de olabilir) */}
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 whitespace-nowrap">
                        {visibleData.length > 0 && (signed || (minVal > 0 && maxVal > 0)) && (
                            <>
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-fg-subtle">{minLabel}</span>
                                    <span className="font-mono text-fg">{pointFormat(minVal)}</span>
                                </span>
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-fg-subtle">{maxLabel}</span>
                                    <span className="font-mono text-fg">{pointFormat(maxVal)}</span>
                                </span>
                            </>
                        )}
                        {refValue !== null && (
                            <span className="flex items-baseline gap-1.5">
                                <span className="text-fg-subtle">{referenceLabel}</span>
                                <span className="font-mono text-fg">{pointFormat(refValue)}</span>
                            </span>
                        )}
                        {unitLabel && !frameless && <span className="text-fg-subtle hidden xl:inline">({unitLabel})</span>}
                    </div>

                    {frameless && <div className="ml-auto">{periodSelector}</div>}
                </div>
            )}

            {/* Grafik ve zaman kaydırıcı */}
            <div
                className={cn('relative w-full pb-1', frameless ? 'pt-1' : 'px-1 sm:px-2 pt-2')}
                style={{ minHeight: height, height }}
            >
                {isLoading ? (
                    <div className={cn('absolute flex items-center justify-center', frameless ? 'inset-0' : 'inset-3')} role="status">
                        <Skeleton className="absolute inset-0" />
                        <span className="relative text-sm text-fg-muted">Grafik verileri yükleniyor...</span>
                    </div>
                ) : !data || data.length === 0 ? (
                    <EmptyState
                        className="h-full"
                        icon={<Activity />}
                        title={emptyMessage}
                    />
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <AreaChart
                            data={data}
                            margin={{ top: 8, right: frameless ? 0 : 8, left: -12, bottom: showBrush ? 6 : 0 }}
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.14} />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />

                            <XAxis
                                dataKey={dateKey}
                                stroke="var(--chart-axis)"
                                tick={AXIS_TICK}
                                height={26}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)' }}
                                minTickGap={48}
                            />

                            <YAxis
                                orientation="left"
                                stroke="var(--chart-axis)"
                                tick={AXIS_TICK}
                                width={72}
                                tickLine={false}
                                axisLine={false}
                                domain={yDomain}
                                tickFormatter={yAxisFormatter}
                            />

                            <RechartsTooltip
                                cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
                                contentStyle={{
                                    backgroundColor: 'var(--surface)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '4px',
                                    color: 'var(--fg)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '14px',
                                    padding: '8px 10px',
                                    boxShadow: 'none',
                                }}
                                itemStyle={{ color: 'var(--fg)', padding: 0 }}
                                formatter={(val) => [pointFormat(Number(val)), title || 'Değer']}
                                labelStyle={{ color: 'var(--fg-muted)', marginBottom: '4px' }}
                            />

                            {/* Sıfır çizgisi: K/Z'nin kâra mı zarara mı geçtiği görünsün; eksen sıfırı kesmiyorsa çizilmez */}
                            {signed && (
                                <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} ifOverflow="discard" />
                            )}

                            {/* Referans (önceki kapanış): kesikli yatay çizgi; eksen gerekirse genişler */}
                            {refValue !== null && (
                                <ReferenceLine
                                    y={refValue}
                                    stroke="var(--fg-subtle)"
                                    strokeDasharray="4 4"
                                    strokeWidth={1}
                                    ifOverflow="extendDomain"
                                    label={{
                                        value: referenceLabel,
                                        position: 'insideBottomRight',
                                        fill: 'var(--fg-subtle)',
                                        fontSize: 13,
                                    }}
                                />
                            )}

                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={lineColor}
                                strokeWidth={1.5}
                                fillOpacity={1}
                                fill={`url(#${gradientId})`}
                                activeDot={{ r: 3.5, fill: lineColor, stroke: frameless ? 'var(--bg)' : 'var(--surface)', strokeWidth: 2 }}
                                isAnimationActive={false}
                            />

                            {/* Zaman kaydırıcı: periyot içinde aralığı daraltmak için */}
                            {showBrush && data.length > 1 && (
                                <Brush
                                    dataKey={dateKey}
                                    height={28}
                                    stroke="var(--border-strong)"
                                    fill="var(--surface-2)"
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
                <div
                    className={cn(
                        'flex items-center justify-between gap-2 py-2 text-xs whitespace-nowrap overflow-hidden',
                        !frameless && 'px-3 sm:px-4 border-t border-border',
                    )}
                >
                    <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-fg-subtle">Başlangıç</span>
                        <span className="font-mono text-fg-muted">{startDateLabel || '-'}</span>
                    </div>

                    <span className="text-fg-subtle hidden md:inline select-none truncate px-2 text-center">
                        Aralığı değiştirmek için çubuğun kenarlarını kaydırın
                    </span>

                    <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-fg-subtle">Bitiş</span>
                        <span className="font-mono text-fg-muted">{endDateLabel || '-'}</span>
                    </div>
                </div>
            )}
        </ChartShell>
    );
});

InteractiveAreaChart.displayName = 'InteractiveAreaChart';

// Çerçeveli modda panel (Card), çerçevesizde yalın kap
function ChartShell({ frameless, className, children }: { frameless: boolean; className?: string; children: React.ReactNode }) {
    if (frameless) return <div className={cn('flex flex-col w-full min-w-0', className)}>{children}</div>;
    return <Card padded={false} className={cn('w-full', className)}>{children}</Card>;
}
