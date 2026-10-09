import type { AssetSummaryMap, PortfolioSnapshot, PortfolioSummary, UserHolding } from '@/types';
import { baseValueFromReturn } from '@/lib/periodUtils';

// interface yerine type: InteractiveAreaChart'ın index imzalı ChartDataPoint tipine atanabilsin diye
export type PortfolioChartPoint = {
    date: string;
    value: number; // gösterilen para biriminde
    raw: number;   // TL
};

interface BuildPortfolioChartParams {
    summary: PortfolioSummary;
    history: PortfolioSnapshot[];
    holdings: UserHolding[];
    assetSummaries: AssetSummaryMap;
    userCreatedAt?: string;
    period: string;
    currentVal: number;        // bugünkü toplam değer (açık pozisyonlar + temettü), TL
    usdDivisor: number | null; // USD gösterimde kur, TL gösterimde null
}

// Portföy değer grafiğinin noktaları. Elde günlük snapshot'lar ve dönem başı değerleri var;
// aradaki noktalar bunlardan doğrusal olarak hesaplanır.
export function buildPortfolioChartData({
    summary,
    history,
    holdings,
    assetSummaries,
    userCreatedAt,
    period,
    currentVal,
    usdDivisor,
}: BuildPortfolioChartParams): PortfolioChartPoint[] {
    const toDisplay = (val: number) => (usdDivisor ? val / usdDivisor : val);

    const now = new Date();
    const nowMs = now.getTime();

    // Geçerli snapshot'lar, eskiden yeniye
    const sortedHistory = [...(history || [])]
        .filter(h => {
            const v = parseFloat(h.total_value);
            return !isNaN(v) && v > 0;
        })
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    // Portföyün başlangıcı: ilk alış, ilk snapshot ya da üyelik tarihi
    let inceptionTime = nowMs;
    let hasInception = false;

    if (holdings && holdings.length > 0) {
        for (const h of holdings) {
            if (h.first_buy_date) {
                const t = new Date(h.first_buy_date).getTime();
                if (!isNaN(t) && t < inceptionTime) {
                    inceptionTime = t;
                    hasInception = true;
                }
            }
        }
    }
    if (sortedHistory && sortedHistory.length > 0) {
        const firstSnapT = new Date(sortedHistory[0].recorded_at).getTime();
        if (!isNaN(firstSnapT) && firstSnapT < inceptionTime) {
            inceptionTime = firstSnapT;
            hasInception = true;
        }
    }
    if (userCreatedAt && !hasInception) {
        const userCreateTime = new Date(userCreatedAt).getTime();
        if (!isNaN(userCreateTime)) {
            inceptionTime = userCreateTime;
            hasInception = true;
        }
    }

    // 1G: önceki gün değerinden bugünkü değere 10:00-18:05 arası 5 dakikalık adımlarla düz çizgi.
    // Gerçek gün içi veri değildir.
    if (period === '1D') {
        // Önceki gün değeri sırasıyla varlıkların 1G getirisinden, backend'in 1G değerinden
        // ya da sondan bir önceki snapshot'tan bulunur; maliyete düşülmez.
        let prevDayVal = currentVal;
        let total1dBase = 0;
        let has1dData = false;
        for (const h of holdings) {
            const sum = assetSummaries[h.symbol];
            const r1 = sum?.['1D'];
            if (r1 !== undefined && !isNaN(r1)) {
                has1dData = true;
                total1dBase += baseValueFromReturn(h.total_value, r1);
            } else {
                total1dBase += h.total_value;
            }
        }

        if (has1dData && total1dBase > 0) {
            prevDayVal = total1dBase;
        } else if (summary.period_values?.['1D'] && summary.period_values['1D'] > 0 && summary.period_values['1D'] !== currentVal) {
            prevDayVal = summary.period_values['1D'];
        } else if (sortedHistory.length > 1) {
            prevDayVal = parseFloat(sortedHistory[sortedHistory.length - 2].total_value);
        }

        const times: string[] = [];
        for (let h = 10; h <= 18; h++) {
            for (let m = 0; m < 60; m += 5) {
                if (h === 18 && m > 5) break;
                times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }

        const diff = currentVal - prevDayVal;
        return times.map((t, idx) => {
            const progress = idx / (times.length - 1);
            const stepVal = prevDayVal + (diff * progress);
            const finalStepVal = idx === times.length - 1 ? currentVal : Math.max(0, stepVal);
            return {
                date: t,
                value: toDisplay(finalStepVal),
                raw: finalStepVal,
            };
        });
    }

    // Dönem başı değeri: backend'in dönem değeri, yoksa varlık getirilerinden geriye hesap, o da yoksa ilk snapshot
    const periodBaseVal = (() => {
        if (period === 'ALL') {
            return summary.total_cost > 0 ? summary.total_cost : currentVal;
        }

        const bVal = summary.period_values?.[period];
        if (bVal && bVal > 0 && bVal !== currentVal) {
            return bVal;
        }

        let weightedBase = 0;
        let foundAny = false;
        for (const h of holdings) {
            const sum = assetSummaries[h.symbol];
            const r = sum?.[period];
            if (r !== undefined && !isNaN(r)) {
                foundAny = true;
                weightedBase += baseValueFromReturn(h.total_value, r);
            } else {
                weightedBase += h.total_value;
            }
        }
        if (foundAny && weightedBase > 0) return weightedBase;

        if (sortedHistory.length > 0) {
            return parseFloat(sortedHistory[0].total_value);
        }

        return currentVal;
    })();

    const effectiveBaseVal = periodBaseVal > 0 ? periodBaseVal : currentVal;

    // Verilen zamandaki portföy değeri (snapshot'lar arasında doğrusal ara değer)
    const interpolateVal = (targetMs: number, spanStartTime: number): number => {
        if (targetMs >= nowMs) return currentVal;
        if (targetMs <= spanStartTime) return effectiveBaseVal;

        if (sortedHistory.length === 0) {
            if (effectiveBaseVal === currentVal) return currentVal;
            const p = Math.max(0, Math.min(1, (targetMs - spanStartTime) / Math.max(1, nowMs - spanStartTime)));
            return effectiveBaseVal + (currentVal - effectiveBaseVal) * p;
        }

        const firstSnapTime = new Date(sortedHistory[0].recorded_at).getTime();
        const firstVal = parseFloat(sortedHistory[0].total_value);

        if (targetMs <= firstSnapTime) {
            const p = Math.max(0, (targetMs - spanStartTime) / Math.max(1, firstSnapTime - spanStartTime));
            return effectiveBaseVal + (firstVal - effectiveBaseVal) * p;
        }

        for (let i = 0; i < sortedHistory.length - 1; i++) {
            const t1 = new Date(sortedHistory[i].recorded_at).getTime();
            const t2 = new Date(sortedHistory[i + 1].recorded_at).getTime();
            if (targetMs >= t1 && targetMs <= t2) {
                const v1 = parseFloat(sortedHistory[i].total_value);
                const v2 = parseFloat(sortedHistory[i + 1].total_value);
                const p = (targetMs - t1) / Math.max(1, t2 - t1);
                return v1 + (v2 - v1) * p;
            }
        }

        // Son snapshot ile şimdi arası
        const lastSnapTime = new Date(sortedHistory[sortedHistory.length - 1].recorded_at).getTime();
        const lastVal = parseFloat(sortedHistory[sortedHistory.length - 1].total_value);
        const p = (targetMs - lastSnapTime) / Math.max(1, nowMs - lastSnapTime);
        return lastVal + (currentVal - lastVal) * p;
    };

    // Periyoda göre nokta zamanları; gün bazlı periyotlarda (1H-1Y) hafta sonları atlanır
    const timeTargets: { label: string; timeMs: number }[] = [];
    let spanStartTime = nowMs;

    const formatDayLabel = (d: Date, includeYear = false): string => {
        if (includeYear) {
            return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' });
        }
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    };

    if (period === '1W') {
        spanStartTime = nowMs - 7 * 86400000;
        // 1H: iş günlerinde 10:00-18:00 arası yarım saatte bir
        for (let d = 7; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const dayLabel = formatDayLabel(dayDate);
            for (let h = 10; h <= 18; h++) {
                for (let m = 0; m < 60; m += 30) {
                    if (h === 18 && m > 0) break;
                    const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, m);
                    if (pt.getTime() > nowMs) continue;
                    timeTargets.push({
                        label: `${dayLabel} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                        timeMs: pt.getTime()
                    });
                }
            }
        }
    } else if (period === '1M') {
        spanStartTime = nowMs - 30 * 86400000;
        // 1A: iş günlerinde 10:00-18:00 arası saat başı
        for (let d = 30; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const dayLabel = formatDayLabel(dayDate);
            for (let h = 10; h <= 18; h++) {
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, 0);
                if (pt.getTime() > nowMs) continue;
                timeTargets.push({
                    label: `${dayLabel} ${String(h).padStart(2, '0')}:00`,
                    timeMs: pt.getTime()
                });
            }
        }
    } else if (period === '3M') {
        spanStartTime = nowMs - 90 * 86400000;
        // 3A: iş günlerinde 10:00-18:00 arası saat başı
        for (let d = 90; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const isDiffYear = dayDate.getFullYear() !== now.getFullYear();
            const dayLabel = formatDayLabel(dayDate, isDiffYear);
            for (let h = 10; h <= 18; h++) {
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, 0);
                if (pt.getTime() > nowMs) continue;
                timeTargets.push({
                    label: `${dayLabel} ${String(h).padStart(2, '0')}:00`,
                    timeMs: pt.getTime()
                });
            }
        }
    } else if (period === '6M') {
        spanStartTime = nowMs - 180 * 86400000;
        // 6A: iş günlerinde 10:00 ve 18:00
        for (let d = 180; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const isDiffYear = dayDate.getFullYear() !== now.getFullYear();
            const dayLabel = formatDayLabel(dayDate, isDiffYear);

            const ptOpen = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 10, 0);
            if (ptOpen.getTime() <= nowMs) {
                timeTargets.push({
                    label: `${dayLabel} 10:00`,
                    timeMs: ptOpen.getTime()
                });
            }

            const ptClose = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
            if (ptClose.getTime() <= nowMs) {
                timeTargets.push({
                    label: `${dayLabel} 18:00`,
                    timeMs: ptClose.getTime()
                });
            }
        }
    } else if (period === 'YTD') {
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        spanStartTime = startOfYear;
        const daysSinceYearStart = Math.max(1, Math.floor((nowMs - startOfYear) / 86400000));
        // YBB: iş günlerinde 18:00
        for (let d = daysSinceYearStart; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
            if (pt.getTime() > nowMs && d === 0) {
                timeTargets.push({
                    label: 'Bugün',
                    timeMs: nowMs
                });
            } else if (pt.getTime() <= nowMs) {
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : formatDayLabel(dayDate),
                    timeMs: pt.getTime()
                });
            }
        }
    } else if (period === '1Y') {
        spanStartTime = nowMs - 365 * 86400000;
        // 1Y: iş günlerinde 18:00
        for (let d = 365; d >= 0; d--) {
            const dayDate = new Date(nowMs - d * 86400000);
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const isDiffYear = dayDate.getFullYear() !== now.getFullYear();
            const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
            if (pt.getTime() > nowMs && d === 0) {
                timeTargets.push({
                    label: 'Bugün',
                    timeMs: nowMs
                });
            } else if (pt.getTime() <= nowMs) {
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : formatDayLabel(dayDate, isDiffYear),
                    timeMs: pt.getTime()
                });
            }
        }
    } else if (period === '3Y') {
        spanStartTime = nowMs - 3 * 365 * 86400000;
        // 3Y: haftada bir, cuma 18:00
        for (let w = 156; w >= 0; w--) {
            const weekDate = new Date(nowMs - w * 7 * 86400000);
            const day = weekDate.getDay();
            const diff = (5 - day);
            weekDate.setDate(weekDate.getDate() + diff);
            const pt = new Date(weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate(), 18, 0);
            if (pt.getTime() <= nowMs) {
                timeTargets.push({
                    label: w === 0 ? 'Bugün' : formatDayLabel(weekDate, true),
                    timeMs: pt.getTime()
                });
            }
        }
    } else { // '5Y' veya 'ALL'
        spanStartTime = nowMs - 5 * 365 * 86400000;
        // 5Y: ayda bir, ayın 15'i 18:00
        for (let m = 60; m >= 0; m--) {
            const mDate = new Date(now.getFullYear(), now.getMonth() - m, 15, 18, 0);
            if (mDate.getTime() <= nowMs) {
                timeTargets.push({
                    label: m === 0 ? 'Bugün' : mDate.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
                    timeMs: mDate.getTime()
                });
            }
        }
    }

    // Seçilen periyot portföyün başlangıcından eskiyse grafik başlangıç tarihinden çizilir,
    // öncesine çizgi eklenmez.
    const effectiveStartTime = hasInception ? Math.max(spanStartTime, inceptionTime) : spanStartTime;

    let filteredTargets = timeTargets.filter(t => t.timeMs >= effectiveStartTime - (4 * 3600 * 1000));

    // En az iki nokta olsun
    if (filteredTargets.length === 0) {
        filteredTargets = [
            { label: 'Başlangıç', timeMs: effectiveStartTime },
            { label: 'Bugün', timeMs: nowMs }
        ];
    } else if (filteredTargets.length === 1) {
        filteredTargets.unshift({
            label: 'Başlangıç',
            timeMs: effectiveStartTime
        });
    } else if (filteredTargets[0].timeMs > effectiveStartTime + 12 * 3600 * 1000) {
        // İlk nokta ile başlangıç arasında boşluk varsa başlangıcı da ekle
        filteredTargets.unshift({
            label: formatDayLabel(new Date(effectiveStartTime)),
            timeMs: effectiveStartTime
        });
    }

    // Aynı etiket tekrar ederse sonuna sıra numarası eklenir
    const usedLabels = new Map<string, number>();
    return filteredTargets.map((item, idx) => {
        let label = item.label;
        const count = usedLabels.get(label) || 0;
        if (count > 0) {
            label = `${label} (${count + 1})`;
        }
        usedLabels.set(item.label, count + 1);

        let val = interpolateVal(item.timeMs, effectiveStartTime);
        if (idx === 0 && effectiveBaseVal > 0) {
            val = effectiveBaseVal;
        } else if (idx === filteredTargets.length - 1) {
            val = currentVal;
        }

        return {
            date: label,
            value: toDisplay(val),
            raw: val,
        };
    });
}
