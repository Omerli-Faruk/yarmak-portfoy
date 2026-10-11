'use client';

import { useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import type { CategorySummary } from '@/types';
import { formatPercent } from '@/lib/formatters';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';

interface AllocationDonutCardProps {
    breakdown?: Record<string, CategorySummary>;
    fmt: (amountTRY: number) => string;
}

// Varlık sınıfı renkleri temadan gelir; iki temada da birbirinden ayrışır
const CATEGORY_COLORS = {
    HISSE: 'var(--primary)',
    FON: 'var(--fg-subtle)',
    ALTIN: 'var(--warning)',
    DOVIZ: 'var(--profit)',
} as const;

// Varlık sınıfı dağılımı (yan sütun): ince yığılmış çubuk + kompakt satırlar
export default function AllocationDonutCard({ breakdown, fmt }: AllocationDonutCardProps) {
    // Varlık sınıflarının toplam değer içindeki payı
    const { categoryData, total } = useMemo(() => {
        if (!breakdown) return { categoryData: [], total: 0 };
        const b = breakdown;
        const items = [
            { name: 'Hisse Senedi', key: 'HISSE', value: b.HISSE?.value || 0, color: CATEGORY_COLORS.HISSE },
            { name: 'Yatırım Fonu', key: 'FON', value: b.FON?.value || 0, color: CATEGORY_COLORS.FON },
            { name: 'Gram Altın', key: 'ALTIN', value: b.ALTIN?.value || 0, color: CATEGORY_COLORS.ALTIN },
            { name: 'Döviz', key: 'DOVIZ', value: b.DOVIZ?.value || 0, color: CATEGORY_COLORS.DOVIZ },
        ].filter(item => item.value > 0);

        const sum = items.reduce((acc, it) => acc + it.value, 0);
        return {
            total: sum,
            categoryData: items.map(it => ({
                ...it,
                percent: sum > 0 ? (it.value / sum) * 100 : 0,
            })),
        };
    }, [breakdown]);

    return (
        <Section title="Dağılım" size="sm" contentClassName="gap-3">
            {categoryData.length > 0 ? (
                <>
                    {/* Payların tek çubukta görünümü; ayrıntı aşağıdaki satırlarda */}
                    <div
                        role="img"
                        aria-label={categoryData.map(c => `${c.name} ${formatPercent(c.percent)}`).join(', ')}
                        className="flex h-2 gap-px overflow-hidden rounded-sm bg-surface-2"
                    >
                        {categoryData.map(c => (
                            <span
                                key={c.key}
                                className="h-full"
                                style={{ width: `${c.percent}%`, backgroundColor: c.color }}
                            />
                        ))}
                    </div>

                    <ul className="flex flex-col divide-y divide-border">
                        {categoryData.map(c => (
                            <li key={c.key} className="flex items-center gap-3 h-11 text-sm">
                                {/* Çubuktaki rengin anahtarı */}
                                <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: c.color }} />
                                <span className="grow min-w-0 truncate text-fg">{c.name}</span>
                                <span className="shrink-0 text-right font-mono text-fg">{fmt(c.value)}</span>
                                <span className="w-16 shrink-0 text-right font-mono text-fg-muted">{formatPercent(c.percent)}</span>
                            </li>
                        ))}
                        <li className="flex items-center gap-3 h-11 text-sm">
                            <span className="grow text-fg-muted">Toplam</span>
                            <span className="shrink-0 text-right font-mono font-medium text-fg">{fmt(total)}</span>
                            <span className="w-16 shrink-0" aria-hidden />
                        </li>
                    </ul>
                </>
            ) : (
                <EmptyState
                    icon={<PieIcon />}
                    title="Portföyünüzde henüz dağılım oluşturacak varlık bulunmuyor."
                />
            )}
        </Section>
    );
}
