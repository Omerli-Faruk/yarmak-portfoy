'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { CategorySummary } from '@/types';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import ChangePill from '@/components/ui/ChangePill';

interface CategoryPnlCardProps {
    breakdown?: Record<string, CategorySummary>;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    usdDivisor: number | null; // USD gösterimde kur, TL gösterimde null
}

// Açık pozisyonların varlık sınıfına göre K/Z'si (yan sütun): kompakt satırlar
export default function CategoryPnlCard({ breakdown, fmt, usdDivisor }: CategoryPnlCardProps) {
    // pnl gösterilen para biriminde (çubuk ölçeği için), rawPnl TL
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

    const hasData = categoryPerformanceData.some(c => c.rawPnl !== 0);
    // Sıfırdan iki yöne uzanan çubukların ölçeği: en büyük mutlak K/Z yarım genişliği doldurur
    const maxAbs = Math.max(...categoryPerformanceData.map(c => Math.abs(c.pnl)), 0);

    return (
        <Section title="Kategori bazında kâr/zarar" description="Açık pozisyonlar" size="sm">
            {hasData ? (
                // Tutarlar işaretiyle de yazılır; renk tek başına bilgi taşımaz
                <ul className="flex flex-col border-t border-border divide-y divide-border">
                    {categoryPerformanceData.map(c => {
                        const width = maxAbs > 0 ? (Math.abs(c.pnl) / maxAbs) * 50 : 0;
                        return (
                            <li key={c.name} className="flex items-center gap-3 h-11 text-sm">
                                <span className="w-14 shrink-0 text-fg">{c.name}</span>
                                <span aria-hidden className="relative h-1.5 grow min-w-12">
                                    <span className="absolute inset-y-0 left-1/2 w-px -ml-px bg-border-strong" />
                                    {width > 0 && (
                                        <span
                                            className={c.rawPnl >= 0 ? 'absolute inset-y-0 left-1/2 bg-profit' : 'absolute inset-y-0 right-1/2 bg-loss'}
                                            style={{ width: `${width}%` }}
                                        />
                                    )}
                                </span>
                                {/* Yandaki Dağılım listesiyle aynı 15px */}
                                <ChangePill
                                    value={c.rawPnl}
                                    showIcon={false}
                                    className="w-36 justify-end text-right"
                                    title={fmt(c.rawPnl, true)}
                                >
                                    {fmt(c.rawPnl, true)}
                                </ChangePill>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <EmptyState icon={<BarChart3 />} title="Henüz kâr/zarar hesaplanacak açık pozisyon yok." />
            )}
        </Section>
    );
}
