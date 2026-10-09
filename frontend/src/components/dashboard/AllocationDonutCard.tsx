'use client';

import { useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import type { CategorySummary } from '@/types';

interface AllocationDonutCardProps {
    breakdown?: Record<string, CategorySummary>;
    fmt: (amountTRY: number) => string;
}

export default function AllocationDonutCard({ breakdown, fmt }: AllocationDonutCardProps) {
    // Varlık sınıflarının toplam değer içindeki payı
    const categoryData = useMemo(() => {
        if (!breakdown) return [];
        const b = breakdown;
        const items = [
            { name: 'Hisse Senedi', key: 'HISSE', value: b.HISSE?.value || 0, color: '#1A9FD3' },
            { name: 'Yatırım Fonu', key: 'FON', value: b.FON?.value || 0, color: '#94A3B8' },
            { name: 'Gram Altın', key: 'ALTIN', value: b.ALTIN?.value || 0, color: '#F59E0B' },
            { name: 'Döviz', key: 'DOVIZ', value: b.DOVIZ?.value || 0, color: '#10B981' },
        ].filter(item => item.value > 0);

        const total = items.reduce((acc, it) => acc + it.value, 0);
        return items.map(it => ({
            ...it,
            percent: total > 0 ? (it.value / total) * 100 : 0,
        }));
    }, [breakdown]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-slate-400" />
                    <h3 className="text-base font-bold text-white">Varlık Sınıfı Dağılımı</h3>
                </div>
                <span className="text-xs text-slate-400">Yüzdesel Pay</span>
            </div>

            {categoryData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-48 h-48 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#fff' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                                    formatter={(val) => [fmt(Number(val)), 'Değer']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex-1 w-full space-y-2.5">
                        {categoryData.map(c => (
                            <div key={c.key} className="flex items-center justify-between bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                                    <span className="text-xs font-semibold text-slate-200">{c.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-white tabular-nums">{fmt(c.value)}</p>
                                    <p className="text-xs text-slate-400 font-mono tabular-nums">
                                        {c.percent.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                    Portföyünüzde henüz dağılım oluşturacak varlık bulunmuyor.
                </div>
            )}
        </div>
    );
}
