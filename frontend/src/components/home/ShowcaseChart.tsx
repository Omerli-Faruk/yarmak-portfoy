'use client';

import { useState, useMemo } from 'react';

const WIDTH = 500;
const HEIGHT = 160;
const PADDING = 10;

interface ShowcaseChartProps {
    // Bin TL cinsinden değerler
    points: number[];
}

// Örnek portföyün çerçevesiz alan grafiği; doğrudan sayfa zemininde durur. Renkler tema değişkenlerinden gelir.
export default function ShowcaseChart({ points }: ShowcaseChartProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const chartPath = useMemo(() => {
        if (!points || points.length === 0) return { line: '', area: '', coords: [], min: 0, max: 0 };

        const minVal = Math.min(...points);
        const maxVal = Math.max(...points);
        const range = maxVal - minVal || 1;

        const coords = points.map((val, idx) => {
            const x = (idx / (points.length - 1)) * (WIDTH - PADDING * 2) + PADDING;
            const y = HEIGHT - PADDING - ((val - minVal) / range) * (HEIGHT - PADDING * 2);
            return { x, y, val };
        });

        // Noktalar düz çizgiyle birleşir; terminal grafiklerindeki gibi köşeli
        const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' ');
        const area = `${line} L ${coords[coords.length - 1].x},${HEIGHT} L ${coords[0].x},${HEIGHT} Z`;

        return { line, area, coords, min: minVal, max: maxVal };
    }, [points]);

    const hovered = hoverIndex !== null ? chartPath.coords[hoverIndex] : undefined;
    // Ok yönü, dönem başındaki değere göre artış mı düşüş mü olduğunu gösterir
    const isUpFromStart = hovered ? hovered.val >= chartPath.coords[0].val : true;

    return (
        <div className="flex gap-2">
            <div className="relative h-48 min-w-0 flex-1 sm:h-60">
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoverIndex(null)}
                    aria-hidden
                >
                    <defs>
                        <linearGradient id="showcaseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.14" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Yatay kılavuz çizgileri */}
                    {[PADDING, HEIGHT / 2, HEIGHT - PADDING].map((y) => (
                        <line
                            key={y}
                            x1={0}
                            y1={y}
                            x2={WIDTH}
                            y2={y}
                            stroke="var(--chart-grid)"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}

                    <path d={chartPath.area} fill="url(#showcaseGrad)" />
                    <path
                        d={chartPath.line}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    {hovered && (
                        <line
                            x1={hovered.x}
                            y1={0}
                            x2={hovered.x}
                            y2={HEIGHT}
                            stroke="var(--border-strong)"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                        />
                    )}

                    {/* Fareyle üzerine gelinen noktayı yakalayan görünmez alanlar */}
                    {chartPath.coords.map((coord, idx) => (
                        <rect
                            key={idx}
                            x={coord.x - 20}
                            y={0}
                            width={40}
                            height={HEIGHT}
                            fill="transparent"
                            className="cursor-crosshair"
                            onMouseEnter={() => setHoverIndex(idx)}
                        />
                    ))}
                </svg>

                {hovered && (
                    <>
                        {/* İşaret noktası SVG dışında çizilir; preserveAspectRatio="none" daireyi basık göstermesin diye */}
                        <span
                            aria-hidden
                            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-primary"
                            style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
                        />
                        <div
                            className="pointer-events-none absolute -top-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded border border-border-strong bg-surface px-2 py-0.5 font-mono text-sm text-fg"
                            style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
                        >
                            <span>{hovered.val} bin ₺</span>
                            {isUpFromStart ? (
                                <span className="text-profit">▲</span>
                            ) : (
                                <span className="text-loss">▼</span>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Sağ eksen: dönemin en yüksek ve en düşük değeri */}
            <div aria-hidden className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-xs text-fg-muted">
                <span>{chartPath.max}</span>
                <span>{chartPath.min}</span>
            </div>
        </div>
    );
}
