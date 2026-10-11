import type { PortfolioValuePoint } from '@/types';

// interface yerine type: InteractiveAreaChart'ın index imzalı ChartDataPoint tipine atanabilsin diye.
// value, cost ve pnl gösterilen para biriminde; raw TL değerdir.
export type PortfolioChartPoint = {
    date: string;
    value: number;
    cost: number;
    pnl: number;
    raw: number;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Sunucudan gelen gerçek değer geçmişini grafik noktalarına çevirir.
// 1G'de saat; aynı güne birden çok nokta düşen dönemlerde gün + saat; diğerlerinde gün yazılır.
// Yıl, 1 yıldan uzun dönemlerde ya da bu yıldan önceki noktalarda eklenir.
export function buildPortfolioChartData(
    points: PortfolioValuePoint[],
    range: string,
    usdDivisor: number | null, // USD gösterimde kur, TL gösterimde null
): PortfolioChartPoint[] {
    const toDisplay = (val: number) => (usdDivisor ? val / usdDivisor : val);
    const dates = points.map(p => new Date(p.t));

    const seenDays = new Set<string>();
    let intraday = false;
    for (const d of dates) {
        const k = dayKey(d);
        if (seenDays.has(k)) { intraday = true; break; }
        seenDays.add(k);
    }

    const thisYear = new Date().getFullYear();
    const longRange = range === '3Y' || range === '5Y';

    const label = (d: Date): string => {
        const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        if (range === '1D') return time;
        const withYear = longRange || d.getFullYear() !== thisYear;
        const day = d.toLocaleDateString('tr-TR', withYear
            ? { day: 'numeric', month: 'short', year: '2-digit' }
            : { day: 'numeric', month: 'short' });
        return intraday ? `${day} ${time}` : day;
    };

    return points.map((p, i) => ({
        date: label(dates[i]),
        value: toDisplay(p.value),
        cost: toDisplay(p.cost),
        pnl: toDisplay(p.pnl),
        raw: p.value,
    }));
}
