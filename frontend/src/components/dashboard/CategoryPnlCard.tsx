'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
} from 'recharts';
import type { CategorySummary } from '@/types';

interface CategoryPnlCardProps {
    breakdown?: Record<string, CategorySummary>;
    fmt: (amountTRY: number) => string;
    usdDivisor: number | null; // USD gösterimde kur, TL gösterimde null
}

// Eksen etiketleri: "1,5 Mn", "250 bin"
function formatAxisTick(val: number): string {
    const abs = Math.abs(val);
    if (abs >= 1e6) return `${(val / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
    if (abs >= 1e3) return `${(val / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} bin`;
    return val.toLocaleString('tr-TR');
}

export default function CategoryPnlCard({ breakdown, fmt, usdDivisor }: CategoryPnlCardProps) {
    // Açık pozisyonların varlık sınıfına göre K/Z'si. pnl gösterilen para biriminde, rawPnl TL.
    const categoryPerformanceData = useMemo(() => {
        if (!breakdown) return [];
        const b = breakdown;
        return [
            { name: 'Hisse', pnl: b.HISSE?.profit_loss || 0 },
            { name: 'Fon', pnl: b.FON?.profit_loss || 0 },
            { name: 'Altın', pnl: b.ALTIN?.profit_loss || 0 },
            { name: 'Döviz', pnl: b.DOVIZ?.profit_loss || 0 },
        ].map(it => ({
            name: it.name,
            pnl: usdDivisor ? it.pnl / usdDivisor : it.pnl,
            rawPnl: it.pnl,
        }));
    }, [breakdown, usdDivisor]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-slate-400" />
                    <h3 className="text-base font-bold text-white">Kategori Bazında Kâr/Zarar (Açık Pozisyonlar)</h3>
                </div>
                <span className="text-xs text-slate-400">{usdDivisor ? 'Dolar Bazında' : 'TL Bazında'}</span>
            </div>

            {categoryPerformanceData.some(c => c.rawPnl !== 0) ? (
                <div className="w-full h-48 sm:h-52">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <BarChart data={categoryPerformanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={formatAxisTick}
                            />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    borderRadius: '0.5rem',
                                    color: '#ffffff',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
                                labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: '4px' }}
                                formatter={(_val, _name, item) => [
                                    fmt(Number(item?.payload?.rawPnl ?? 0)),
                                    'Kâr / Zarar',
                                ]}
                            />
                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                {categoryPerformanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.rawPnl >= 0 ? '#10b981' : '#f43f5e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                    Henüz kâr/zarar hesaplanacak açık pozisyon yok.
                </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Yeşil: Kâr • Kırmızı: Zarar</span>
                <Link href="/holdings" className="text-[#1A9FD3] hover:text-[#1589B7] font-semibold transition flex items-center gap-1">
                    Detaylı Varlık Listesi <ArrowUpRight className="w-3 h-3" />
                </Link>
            </div>
        </div>
    );
}
