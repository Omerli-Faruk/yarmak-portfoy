'use client';

import type { ReactNode } from 'react';
import Section from '@/components/ui/Section';
import Badge from '@/components/ui/Badge';
import type { AssetFundamentals } from './types';

// Etiket/değer satırı: etiket solda, değer sağda mono
function Row({ label, value }: { label: ReactNode; value?: string }) {
    return (
        <div className="flex items-center justify-between gap-3 min-h-11 py-1">
            <dt className="flex items-center gap-2 min-w-0 text-sm text-fg-muted">{label}</dt>
            <dd className="font-mono text-sm text-fg text-right truncate">{value}</dd>
        </div>
    );
}

// Hisseler için Yahoo'dan gelen temel veriler. Değerler API'den biçimlenmiş metin olarak gelir.
export default function FundamentalsGrid({ fundamentals, className }: { fundamentals: AssetFundamentals; className?: string }) {
    return (
        <Section title="Temel veriler" size="sm" className={className}>
            <dl className="flex flex-col border-y border-border divide-y divide-border">
                <Row label="Piyasa değeri" value={fundamentals.marketCap} />
                <Row label="F/K oranı" value={fundamentals.peRatio} />
                <Row label="Temettü verimi" value={fundamentals.dividendYield} />
                {fundamentals.dividendRate !== '-' && (
                    <Row label="Hisse başı temettü" value={fundamentals.dividendRate} />
                )}
                {fundamentals.exDividendDate !== '-' && (
                    <Row
                        label={
                            <>
                                <span className="truncate">{fundamentals.exDividendLabel || (fundamentals.isExDateFuture === 'true' ? 'Açıklanan temettü' : 'Son temettü tarihi')}</span>
                                {/* Bu alandaki tek durum rozeti */}
                                {fundamentals.isExDateFuture === 'true' && <Badge tone="warning">Planlanan</Badge>}
                            </>
                        }
                        value={fundamentals.exDividendDate}
                    />
                )}
                <Row label="Beta (risk)" value={fundamentals.beta} />
                <Row label="52 hafta zirve" value={fundamentals.fiftyTwoWeekHigh} />
                <Row label="52 hafta dip" value={fundamentals.fiftyTwoWeekLow} />
                <Row label="Hacim" value={fundamentals.volume} />
            </dl>
        </Section>
    );
}
