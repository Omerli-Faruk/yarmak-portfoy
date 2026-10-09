'use client';

import { useState, useMemo } from 'react';

const WIDTH = 500;
const HEIGHT = 140;
const PADDING = 12;

interface ShowcaseChartProps {
    // Bin TL cinsinden değerler
    points: number[];
}

// Örnek portföyün küçük alan grafiği
export default function ShowcaseChart({ points }: ShowcaseChartProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const chartPath = useMemo(() => {
        if (!points || points.length === 0) return { line: '', area: '', coords: [] };

        const minVal = Math.min(...points);
        const maxVal = Math.max(...points);
        const range = maxVal - minVal || 1;

        const coords = points.map((val, idx) => {
            const x = (idx / (points.length - 1)) * (WIDTH - PADDING * 2) + PADDING;
            const y = HEIGHT - PADDING - ((val - minVal) / range) * (HEIGHT - PADDING * 2);
            return { x, y, val };
        });

        // Noktalar arasını yumuşak eğriyle birleştir
        let line = `M ${coords[0].x},${coords[0].y}`;
        for (let i = 0; i < coords.length - 1; i++) {
            const curr = coords[i];
            const next = coords[i + 1];
            const mx = (curr.x + next.x) / 2;
            line += ` C ${mx},${curr.y} ${mx},${next.y} ${next.x},${next.y}`;
        }

        const area = `${line} L ${coords[coords.length - 1].x},${HEIGHT} L ${coords[0].x},${HEIGHT} Z`;

        return { line, area, coords };
    }, [points]);

    const hovered = hoverIndex !== null ? chartPath.coords[hoverIndex] : undefined;
    // Ok yönü, dönem başındaki değere göre artış mı düşüş mü olduğunu gösterir
    const isUpFromStart = hovered ? hovered.val >= chartPath.coords[0].val : true;

    return (
        <div className="relative w-full h-36 mt-4">
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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

                {/* Dikey kılavuz çizgileri */}
                {[100, 200, 300, 400].map((x) => (
                    <line
                        key={x}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={HEIGHT}
                        stroke="rgba(255,255,255,0.04)"
                        strokeDasharray="4 4"
                    />
                ))}

                <path d={chartPath.area} fill="url(#showcaseGrad)" />
                <path
                    d={chartPath.line}
                    fill="none"
                    stroke="#1A9FD3"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                {hovered && (
                    <>
                        <line
                            x1={hovered.x}
                            y1={0}
                            x2={hovered.x}
                            y2={HEIGHT}
                            stroke="#1A9FD3"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                        />
                        <circle
                            cx={hovered.x}
                            cy={hovered.y}
                            r="4.5"
                            fill="#0D1117"
                            stroke="#1A9FD3"
                            strokeWidth="2.5"
                        />
                    </>
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
                <div
                    className="absolute pointer-events-none -top-3 transform -translate-x-1/2 bg-[#090D14]/95 border border-primary/40 px-2.5 py-1 rounded shadow-lg text-[11px] font-mono text-white flex items-center gap-1.5"
                    style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
                >
                    <span className="text-slate-400">{hovered.val} bin ₺</span>
                    {isUpFromStart ? (
                        <span className="text-emerald-400 font-bold">▲</span>
                    ) : (
                        <span className="text-rose-400 font-bold">▼</span>
                    )}
                </div>
            )}
        </div>
    );
}
