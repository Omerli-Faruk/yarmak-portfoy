import { cn } from '@/lib/cn';

export type SparklineColor = 'auto' | 'primary' | 'profit' | 'loss' | 'muted';

export interface SparklineProps {
    values: ReadonlyArray<number>; // eskiden yeniye sıralı gerçek değerler
    width?: number;
    height?: number;
    strokeWidth?: number;
    color?: SparklineColor; // auto: son değer ilkinden büyükse yeşil, küçükse kırmızı, eşitse gri
    ariaLabel?: string;     // verilmezse ekran okuyucudan gizlenir
    className?: string;
}

const COLOR_VARS: Record<Exclude<SparklineColor, 'auto'>, string> = {
    primary: 'var(--primary)',
    profit: 'var(--profit)',
    loss: 'var(--loss)',
    muted: 'var(--fg-subtle)',
};

// Küçük satır içi çizgi grafik. Yalnızca gerçek veriyle çizilir; 3'ten az geçerli nokta varsa hiçbir şey çizmez.
export default function Sparkline({
    values,
    width = 64,
    height = 20,
    strokeWidth = 1.25,
    color = 'auto',
    ariaLabel,
    className,
}: SparklineProps) {
    const points = values.filter(v => Number.isFinite(v));
    if (points.length < 3) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const resolved = color !== 'auto' ? color : last > first ? 'profit' : last < first ? 'loss' : 'muted';

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const pad = strokeWidth; // çizgi kenarlarda kesilmesin
    const stepX = (width - pad * 2) / (points.length - 1);
    const coords = points
        .map((v, i) => {
            const x = pad + i * stepX;
            // Değerler eşitse çizgi ortadan geçer
            const y = max === min ? height / 2 : pad + (1 - (v - min) / range) * (height - pad * 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={cn('shrink-0 overflow-visible', className)}
            role={ariaLabel ? 'img' : undefined}
            aria-label={ariaLabel}
            aria-hidden={ariaLabel ? undefined : true}
        >
            <polyline
                points={coords}
                fill="none"
                stroke={COLOR_VARS[resolved]}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

// Dönem getirilerinden kaba ama gerçek bir fiyat serisi çıkarır.
// returnsOldestFirst: en uzun dönemden en kısaya yüzde getiriler (ör. [1Y, 6A, 3A, 1A, 1H, 1G]).
// Her nokta: fiyat = güncel / (1 + r/100). Eksik veya geçersiz getiriler atlanır, sona güncel fiyat eklenir.
// 3'ten az nokta çıkarsa boş dizi döner (Sparkline zaten hiçbir şey çizmez). Asla veri uydurmaz.
export function seriesFromPeriodReturns(
    current: number,
    returnsOldestFirst: ReadonlyArray<number | null | undefined>,
): number[] {
    if (!Number.isFinite(current) || current <= 0) return [];
    const series: number[] = [];
    for (const r of returnsOldestFirst) {
        if (r === null || r === undefined || !Number.isFinite(r) || r <= -100) continue;
        series.push(current / (1 + r / 100));
    }
    series.push(current);
    return series.length >= 3 ? series : [];
}
