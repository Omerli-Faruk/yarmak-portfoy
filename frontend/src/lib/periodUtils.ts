import { Period } from '@/types';

// Periyot kodlarının ekrandaki kısa adları
export const PERIOD_LABELS: Record<string, string> = {
    '1D': '1G',
    '1W': '1H',
    '1M': '1A',
    '3M': '3A',
    '6M': '6A',
    'YTD': 'YBB',
    '1Y': '1Y',
    '3Y': '3Y',
    '5Y': '5Y',
    'ALL': 'Tümü',
};

// Grafik periyot düğmeleri, soldan sağa bu sırayla
export const CHART_PERIODS: { id: string; label: string }[] = [
    '1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL',
].map(id => ({ id, label: PERIOD_LABELS[id] }));

// Bugünkü değer ve dönem getirisinden (%) dönem başındaki değeri bulur. -%100 ve altında başlangıç 0 sayılır.
export function baseValueFromReturn(value: number, retPct: number): number {
    return retPct <= -100 ? 0 : value / (1 + retPct / 100);
}

/**
 * Varlık seçilen periyottan daha yeniyse true döner: ya fiyat geçmişi periyodu kapsamıyor
 * ya da kullanıcı varlığı periyot başladıktan sonra almış. Bu durumda dönem K/Z'si olarak
 * pozisyon açılışından bugüne kadarki K/Z kullanılır.
 */
export function isHoldingNewerThanPeriod(
    firstBuyDateStr: string | undefined,
    period: Period,
    rawPeriodRet: number | null,
    retAll: number | null
): boolean {
    if (period === 'ALL') return true;

    // Fiyat geçmişi periyodu kapsamıyorsa getiri ALL ile aynı gelir.
    if (period !== '1D' && period !== '1W') {
        if (rawPeriodRet === null || isNaN(rawPeriodRet)) return true;
        if (retAll !== null && !isNaN(retAll) && Math.abs(rawPeriodRet - retAll) < 0.0001) {
            return true;
        }
    }

    // İlk alış tarihi periyodun başlangıcından sonraysa
    if (firstBuyDateStr) {
        const buyDate = new Date(firstBuyDateStr);
        if (!isNaN(buyDate.getTime())) {
            const now = new Date();
            let periodStartDate: Date | null = null;
            if (period === '1D') {
                periodStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            } else if (period === '1W') {
                periodStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (period === '1M') {
                periodStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            } else if (period === '3M') {
                periodStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            } else if (period === '6M') {
                periodStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            } else if (period === 'YTD') {
                periodStartDate = new Date(now.getFullYear(), 0, 1);
            } else if (period === '1Y') {
                periodStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            } else if (period === '3Y') {
                periodStartDate = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
            }

            if (periodStartDate && buyDate > periodStartDate) {
                return true;
            }
        }
    }

    return false;
}

// Seçilen periyot için tablo ve kart başlığı
export function getPeriodHeaderLabel(selectedPeriod: Period): string {
    switch (selectedPeriod) {
        case 'ALL':
            return 'Tüm Zamanlar K/Z';
        case '1D':
            return 'Günlük (1G) K/Z';
        case '1W':
            return 'Haftalık (1H) K/Z';
        case '1M':
            return 'Aylık (1A) K/Z';
        case '3M':
            return '3 Aylık (3A) K/Z';
        case '6M':
            return '6 Aylık (6A) K/Z';
        case 'YTD':
            return 'Yılbaşından Bugüne (YBB) K/Z';
        case '1Y':
            return 'Yıllık (1Y) K/Z';
        case '3Y':
            return '3 Yıllık (3Y) K/Z';
        default:
            return `${selectedPeriod} K/Z`;
    }
}
