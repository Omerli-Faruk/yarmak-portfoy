'use client';

import React from 'react';
import type { Period } from '@/types';
import { PERIOD_LABELS, getPeriodHeaderLabel } from '@/lib/periodUtils';
import ChangePill from '@/components/ui/ChangePill';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Hero, { HeroMeta } from '@/components/ui/Hero';
import SummaryStrip, { type SummaryStripItem } from '@/components/ui/SummaryStrip';

// Varlıklarım sayfasında seçilebilen getiri dönemleri (5Y yok)
const HOLDINGS_PERIODS: Period[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'];

const PERIOD_OPTIONS = HOLDINGS_PERIODS.map(p => ({ value: p, label: PERIOD_LABELS[p] }));

interface PeriodSummaryBarProps {
    selectedPeriod: Period;
    onPeriodChange: (period: Period) => void;
    metrics: {
        isCustomGroup: boolean;
        groupName: string;
        assetCount: number;
        totalVal: number;
        totalCost: number;
        pnlAmount: number;
        pnlPercent: number;
    };
    totalDividends: number;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
}

// Sayfanın odak noktası: seçili grubun (ya da tüm portföyün) değeri, altında seçili dönemin K/Z'si,
// sağda getiri dönemi seçici. Destekleyici rakamlar hemen altındaki tek şeritte.
export default function PeriodSummaryBar({
    selectedPeriod,
    onPeriodChange,
    metrics,
    totalDividends,
    fmt,
}: PeriodSummaryBarProps) {
    const showDividends = !metrics.isCustomGroup && totalDividends > 0;

    // Grubun adı zaten kahraman etiketinde yazdığı için burada tekrar edilmez
    const pnlLabel = selectedPeriod === 'ALL' ? 'Toplam getiri' : getPeriodHeaderLabel(selectedPeriod);

    // Pozisyonların maliyete göre toplam K/Z'si. "Tümü" seçiliyken kahraman satırıyla aynı olduğu için şeritte gösterilmez.
    const allTimePnl = metrics.totalVal - metrics.totalCost;
    const allTimePct = metrics.totalCost > 0 ? (allTimePnl / metrics.totalCost) * 100 : 0;

    const stripItems: SummaryStripItem[] = [];
    if (showDividends) {
        stripItems.push(
            { label: 'Varlıklar', value: fmt(metrics.totalVal) },
            { label: 'Nakit temettü', value: `+${fmt(totalDividends)}`, tone: 'profit' },
        );
    }
    stripItems.push({ label: 'Maliyet', value: fmt(metrics.totalCost) });
    if (selectedPeriod !== 'ALL') {
        // Tutar üstte, yüzde altında: dar şerit hücresinde tek satıra sığmıyordu
        stripItems.push({
            label: 'Net K/Z (toplam)',
            value: fmt(allTimePnl, true),
            tone: allTimePnl > 0 ? 'profit' : allTimePnl < 0 ? 'loss' : 'default',
            hint: <ChangePill value={allTimePct} />,
        });
    }
    // Varlık sayısı grup sekmesinin yanında yazdığı için şeritte tekrar edilmez

    return (
        <div className="flex flex-col gap-6">
            <Hero
                label={metrics.isCustomGroup ? `${metrics.groupName} değeri` : 'Toplam değer'}
                value={fmt(metrics.isCustomGroup ? metrics.totalVal : (metrics.totalVal + totalDividends))}
                sub={
                    <HeroMeta label={pnlLabel}>
                        <ChangePill value={metrics.pnlPercent} amount={fmt(metrics.pnlAmount, true)} size="md" />
                    </HeroMeta>
                }
                aside={
                    <SegmentedControl
                        options={PERIOD_OPTIONS}
                        value={selectedPeriod}
                        onChange={onPeriodChange}
                        size="sm"
                        mono
                        ariaLabel="Getiri dönemi"
                        className="touch-pan-x"
                    />
                }
            />
            <SummaryStrip items={stripItems} ariaLabel="Özet" />
        </div>
    );
}
