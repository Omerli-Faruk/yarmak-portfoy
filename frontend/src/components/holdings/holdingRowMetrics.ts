import type { AssetSummaryMap, Period, UserHolding } from '@/types';
import { isHoldingNewerThanPeriod } from '@/lib/periodUtils';
import { seriesFromPeriodReturns } from '@/components/ui/Sparkline';

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

// Satırdaki küçük çizgi grafik için varlığın dönem getirilerinden çıkan kaba fiyat serisi (1Y, 6A, 3A, 1A, 1H, 1G, bugün).
// Veri yoksa ya da 3 noktadan azsa boş dizi döner; hiçbir değer uydurulmaz.
export function getHoldingSparkline(h: UserHolding, assetSummaries: AssetSummaryMap): number[] {
    const sum = assetSummaries[h.symbol];
    if (!sum) return [];
    // Getirisi tam 0 olan dönemler çoğu zaman eksik veridir (sayfa da 0'ı geçersiz sayar), bu yüzden atlanır
    const returns = (['1Y', '6M', '3M', '1M', '1W', '1D'] as const).map(p => (sum[p] === 0 ? null : sum[p]));
    return seriesFromPeriodReturns(h.current_price, returns);
}
