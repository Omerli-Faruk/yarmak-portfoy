'use client';

import type { ReactNode } from 'react';
import { formatTRY } from '@/lib/formatters';
import Section from '@/components/ui/Section';
import ChangePill from '@/components/ui/ChangePill';

interface PositionCardProps {
    totalLots: number;
    avgCost: number;
    totalValue: number;
    profitLoss: number;
    profitLossPercent: number;
    className?: string;
}

// Etiket solda, değer sağda mono
function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 min-h-12 py-1">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="flex flex-wrap items-baseline justify-end gap-x-3 font-mono text-sm text-fg text-right">{children}</dd>
        </div>
    );
}

// Kullanıcının bu varlıktaki pozisyonu: lot, ortalama maliyet, güncel değer ve kâr/zarar.
// "İşlem ekle" fiyatın yanında olduğu için burada ikinci bir düğme yok.
export default function PositionCard({
    totalLots,
    avgCost,
    totalValue,
    profitLoss,
    profitLossPercent,
    className,
}: PositionCardProps) {
    return (
        <Section title="Pozisyonunuz" className={className}>
            {totalLots <= 0 ? (
                <p className="py-3 border-y border-border text-sm text-fg-muted">Bu varlıktan portföyünüzde henüz lot bulunmuyor.</p>
            ) : (
                <dl className="flex flex-col border-y border-border divide-y divide-border">
                    <Row label="Lot">{totalLots.toLocaleString('tr-TR')}</Row>
                    <Row label="Ortalama maliyet">{formatTRY(avgCost, 3)}</Row>
                    <Row label="Değer">{formatTRY(totalValue)}</Row>
                    <Row label="Kâr/zarar">
                        <ChangePill value={profitLossPercent} amount={formatTRY(profitLoss, 2, true)} />
                    </Row>
                </dl>
            )}
        </Section>
    );
}
