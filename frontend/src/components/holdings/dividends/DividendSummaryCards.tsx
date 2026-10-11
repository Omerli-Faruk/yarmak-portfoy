'use client';

import React from 'react';
import SummaryStrip from '@/components/ui/SummaryStrip';

export interface DividendMetrics {
    totalGross: number;
    totalTax: number;
    totalNet: number;
    uniqueAssetsCount: number;
    totalCount: number;
}

interface DividendSummaryCardsProps {
    metrics: DividendMetrics;
    fmt: (value: number, showPlus?: boolean) => string;
}

// Temettü özeti: tek şeritte dört etiket/değer hücresi. Açıklamalar üzerine gelince görünür.
export default function DividendSummaryCards({ metrics, fmt }: DividendSummaryCardsProps) {
    return (
        <SummaryStrip
            ariaLabel="Temettü özeti"
            items={[
                {
                    label: 'Net temettü',
                    value: fmt(metrics.totalNet),
                    tone: 'profit',
                    title: 'Yatırım hesabınıza yatan net nakit',
                },
                {
                    label: 'Brüt tutar',
                    value: fmt(metrics.totalGross),
                    title: 'Stopaj kesilmeden önceki toplam tutar',
                },
                {
                    label: 'Şirket sayısı',
                    value: metrics.uniqueAssetsCount,
                    title: 'Portföyünüzden temettü verenler',
                },
                {
                    label: 'Ödeme sayısı',
                    value: metrics.totalCount,
                    title: 'Kayıtlı toplam temettü hareketi',
                },
            ]}
        />
    );
}
