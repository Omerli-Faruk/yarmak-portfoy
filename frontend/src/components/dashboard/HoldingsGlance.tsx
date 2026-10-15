'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { AssetSummaryMap, UserHolding } from '@/types';
import Section from '@/components/ui/Section';
import ChangePill from '@/components/ui/ChangePill';
import Sparkline, { seriesFromPeriodReturns } from '@/components/ui/Sparkline';
import { getHoldingRowMetrics } from '@/components/holdings/holdingRowMetrics';
import { formatPercent } from '@/lib/formatters';
import { tableHeadRowClasses } from '@/components/ui/tableStyles';

interface HoldingsGlanceProps {
    holdings: UserHolding[];
    assetSummaries: AssetSummaryMap;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    equityVal: number; // açık pozisyonların toplamı (TL), pay hesabı için
    className?: string;
}

// Panoda gösterilen en büyük pozisyon sayısı; tamamı Varlıklarım sayfasında
const MAX_ROWS = 10;

// Değere göre en büyük pozisyonlar: kutusuz, ince çizgili liste
export default function HoldingsGlance({ holdings, assetSummaries, fmt, equityVal, className }: HoldingsGlanceProps) {
    const rows = useMemo(
        () => [...holdings]
            .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
            .slice(0, MAX_ROWS)
            .map(h => {
                const metrics = getHoldingRowMetrics(h, '1D', assetSummaries);
                const sum = assetSummaries[h.symbol];
                // Dönem getirilerinden çıkarılan kaba fiyat serisi (1Y → bugün); veri yoksa çizilmez
                const trend = sum
                    ? seriesFromPeriodReturns(h.current_price, [sum['1Y'], sum['6M'], sum['3M'], sum['1M'], sum['1W'], sum['1D']])
                    : [];
                return {
                    h,
                    metrics,
                    trend,
                    weight: equityVal > 0 ? (h.total_value / equityVal) * 100 : 0,
                };
            }),
        [holdings, assetSummaries, equityVal]
    );

    if (rows.length === 0) return null;

    // Liste kısaltıldıysa "Tümünü gör (sayı)", zaten tamsa Varlıklarım sayfasına "Yönet ve grupla"
    const truncated = holdings.length > MAX_ROWS;

    return (
        <Section
            title="Varlıklarınız"
            className={className}
            action={
                <Link
                    href="/holdings"
                    className="inline-flex items-center gap-1 min-h-11 sm:min-h-10 rounded text-sm font-medium text-primary hover:text-primary-hover transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {truncated ? 'Tümünü gör' : 'Yönet ve grupla'}
                    {truncated && <span className="font-mono text-fg-muted">({holdings.length})</span>}
                </Link>
            }
        >
            {/* Başlık satırı: sütun genişlikleri satırlarla aynı; mobilde satırlar iki katlı olduğu için gizli */}
            <div aria-hidden className={tableHeadRowClasses('hidden sm:flex gap-4')}>
                <span className="grow min-w-0">Varlık</span>
                <span className="hidden md:block w-16 shrink-0 text-right">1Y</span>
                <span className="hidden xl:block w-28 shrink-0 text-right">Fiyat</span>
                <span className="w-36 shrink-0 text-right">Değer</span>
                <span className="hidden xl:block w-16 shrink-0 text-right">Pay</span>
                <span className="w-24 shrink-0 text-right">1G</span>
                <span className="w-24 shrink-0 text-right">K/Z %</span>
            </div>

            <ul className="flex flex-col border-t border-border sm:border-t-0 divide-y divide-border">
                {rows.map(({ h, metrics, trend, weight }) => (
                    <li key={h.asset_id ?? h.symbol}>
                        <Link
                            href={`/assets/${h.symbol}`}
                            className="flex items-center gap-4 h-16 sm:h-12 px-3 rounded text-sm hover:bg-surface-2 transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        >
                            <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 grow min-w-0">
                                <span className="font-mono font-medium text-fg">{h.symbol}</span>
                                <span className="text-xs text-fg-muted truncate">{h.asset_name}</span>
                            </span>
                            <span className="hidden md:flex w-16 shrink-0 justify-end">
                                <Sparkline values={trend} width={56} height={18} />
                            </span>
                            <span className="hidden xl:block w-28 shrink-0 text-right font-mono text-fg">{fmt(h.current_price)}</span>
                            <span className="flex flex-col items-end w-36 shrink-0">
                                {/* Varlıklarım tablosundaki gibi değer kalın, fiyat normal */}
                                <span className="font-mono font-medium text-fg">{fmt(h.total_value)}</span>
                                {/* Mobilde K/Z yüzdesi değerin altında */}
                                <ChangePill value={metrics.pnlPct} className="sm:hidden" />
                            </span>
                            <span className="hidden xl:block w-16 shrink-0 text-right font-mono text-fg">{formatPercent(weight)}</span>
                            <span className="hidden sm:flex w-24 shrink-0 justify-end">
                                {metrics.periodRetVal !== null
                                    ? <ChangePill value={metrics.periodRetVal} showIcon={false} />
                                    : <span className="font-mono text-fg-muted">-</span>}
                            </span>
                            <span className="hidden sm:flex w-24 shrink-0 justify-end">
                                <ChangePill value={metrics.pnlPct} title={`K/Z ${fmt(metrics.pnl, true)}`} />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </Section>
    );
}
