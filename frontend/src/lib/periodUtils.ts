import { Period } from '@/types';

/**
 * Varlığın seçilen periyottan daha yeni olup olmadığını veya borsa geçmişinin yetip yetmediğini kontrol eder.
 * Eğer hisse bu periyottan daha yeniyse (veya kullanıcı bu hisseyi periyot başladıktan sonra aldıysa),
 * hissenin dönemsel kâr/zararı doğrudan kullanıcının pozisyon açılışından bugüne kadarki Net K/Z'sidir.
 */
export function isHoldingNewerThanPeriod(
    firstBuyDateStr: string | undefined,
    period: Period,
    rawPeriodRet: number | null,
    retAll: number | null
): boolean {
    if (period === 'ALL') return true;

    // 1) Hissenin borsa geçmişi seçilen periyoda yetmiyorsa (ALL ile aynı getiri dönmüşse):
    if (period !== '1D' && period !== '1W') {
        if (rawPeriodRet === null || isNaN(rawPeriodRet)) return true;
        if (retAll !== null && !isNaN(retAll) && Math.abs(rawPeriodRet - retAll) < 0.0001) {
            return true;
        }
    }

    // 2) Kullanıcının bu hisseyi portföye ilk alış tarihi seçilen periyodun başlangıcından daha sonraysa:
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

/**
 * Seçilen periyot için tablo ve kart başlık etiketini döner.
 */
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
            return 'Yılbaşından Bugüne (YTD) K/Z';
        case '1Y':
            return 'Yıllık (1Y) K/Z';
        case '3Y':
            return '3 Yıllık (3Y) K/Z';
        default:
            return `${selectedPeriod} K/Z`;
    }
}
