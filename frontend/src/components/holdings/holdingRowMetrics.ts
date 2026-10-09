import type { AssetSummaryMap, Period, UserHolding } from '@/types';
import { isHoldingNewerThanPeriod } from '@/lib/periodUtils';

export interface HoldingRowMetrics {
    pnl: number;                  // pozisyonun toplam K/Z'si (TL)
    pnlPct: number;               // maliyete göre K/Z yüzdesi
    isPos: boolean;
    periodRetVal: number | null;  // seçili dönemin getirisi (%); veri yoksa null
    periodPnl: number | null;     // seçili dönemin K/Z'si (TL); veri yoksa null
    isPeriodPos: boolean;
}

// Tablodaki bir satırın toplam ve dönemsel K/Z değerleri
export function getHoldingRowMetrics(h: UserHolding, period: Period, assetSummaries: AssetSummaryMap): HoldingRowMetrics {
    const costVal = h.average_cost * h.total_amount;
    const pnl = h.profit_loss;
    const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0;

    const sum = assetSummaries[h.symbol];
    const rawPeriodRet = (sum && sum[period] !== undefined) ? sum[period] : null;
    const retAll = (sum && sum['ALL'] !== undefined) ? sum['ALL'] : null;

    // Varlık dönem başından sonra alındıysa dönem K/Z'si, pozisyonun kendi K/Z'sidir
    const isNewer = isHoldingNewerThanPeriod(h.first_buy_date, period, rawPeriodRet, retAll);

    let periodRetVal: number | null = null;
    let periodPnl: number | null = null;

    if (isNewer) {
        periodRetVal = pnlPct;
        periodPnl = pnl;
    } else if (rawPeriodRet !== null) {
        periodRetVal = rawPeriodRet;
        if (periodRetVal > -100) {
            periodPnl = h.total_value - (h.total_value / (1 + (periodRetVal / 100)));
        } else {
            periodPnl = -h.total_value;
        }
    }

    return {
        pnl,
        pnlPct,
        isPos: pnl >= 0,
        periodRetVal,
        periodPnl,
        isPeriodPos: periodPnl !== null ? periodPnl >= 0 : true,
    };
}
