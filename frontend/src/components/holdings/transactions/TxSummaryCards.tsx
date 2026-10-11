'use client';

import React from 'react';
import SummaryStrip from '@/components/ui/SummaryStrip';

export interface TxMetrics {
    totalCount: number;
    buyCount: number;
    sellCount: number;
    totalBuyVolume: number;
    totalSellVolume: number;
    totalRealizedPnL: number;
    totalCommission: number;
}

interface TxSummaryCardsProps {
    metrics: TxMetrics;
    fmt: (value: number, showPlus?: boolean) => string;
}

// İşlem özeti: tek şeritte dört etiket/değer hücresi. Açıklamalar üzerine gelince görünür.
export default function TxSummaryCards({ metrics, fmt }: TxSummaryCardsProps) {
    return (
        <SummaryStrip
            ariaLabel="İşlem özeti"
            items={[
                {
                    // Toplam işlem sayısı; alış/satış dağılımı altında küçük satırda
                    label: 'İşlem sayısı',
                    value: metrics.totalCount,
                    hint: (
                        <span className="font-mono">
                            <span className="text-profit">{metrics.buyCount} alış</span>
                            <span aria-hidden> · </span>
                            <span className="text-loss">{metrics.sellCount} satış</span>
                        </span>
                    ),
                },
                {
                    label: 'Alış hacmi',
                    value: fmt(metrics.totalBuyVolume),
                    title: 'Alışların toplam tutarı (komisyon hariç)',
                },
                {
                    label: 'Gerçekleşen K/Z',
                    value: fmt(metrics.totalRealizedPnL, true),
                    tone: metrics.totalRealizedPnL >= 0 ? 'profit' : 'loss',
                    title: 'Satışlardan gerçekleşen kâr/zarar',
                },
                {
                    label: 'Komisyon',
                    value: fmt(metrics.totalCommission),
                    title: 'Girdiğiniz toplam komisyon',
                },
            ]}
        />
    );
}
