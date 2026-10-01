'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PortfolioSummary, PortfolioSnapshot, UserHolding } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { InteractiveAreaChart, ChartPeriod } from '@/components/InteractiveAreaChart';
import { formatCurrency } from '@/lib/formatters';
import { useCurrency } from '@/hooks/useCurrency';
import { fetchAssetSummariesBulk, invalidateAssetCache } from '@/lib/assetCache';
import {
    TrendingUp,
    TrendingDown,
    Briefcase,
    Layers,
    Receipt,
    RefreshCw,
    ArrowUpRight,
    PieChart as PieIcon,
    BarChart3
} from 'lucide-react';
import {
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from 'recharts';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
    const [holdings, setHoldings] = useState<UserHolding[]>([]);
    const [dividends, setDividends] = useState<{ tax_amount?: string; TaxAmount?: string }[]>([]);
    const [assetSummaries, setAssetSummaries] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Para birimi seçimi: 'TRY' veya 'USD'
    const { currency, toggleCurrency } = useCurrency();

    // Portföy grafik periyodu: 1D (Günlük), 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, ALL
    const [chartPeriod, setChartPeriod] = useState<string>('1M');

    const loadDashboardData = async (isManualRefresh = false) => {
        try {
            setRefreshing(true);
            if (isManualRefresh) {
                invalidateAssetCache();
            }
            const [sumRes, histRes, holdRes, divRes] = await Promise.all([
                api.get<PortfolioSummary>('/portfolio/summary').catch(() => null),
                api.get<PortfolioSnapshot[]>('/portfolio/history').catch(() => null),
                api.get<UserHolding[]>('/portfolio/holdings').catch(() => null),
                api.get<{ tax_amount?: string; TaxAmount?: string }[]>('/dividends').catch(() => null),
            ]);

            if (sumRes?.data) setSummary(sumRes.data);
            if (histRes?.data) setHistory(histRes.data);
            if (holdRes?.data) {
                const holds = holdRes.data;
                setHoldings(holds);
                // Varlıkların periyot getirilerini akıllı önbellekten veya batch istek ile çek
                const symbols = holds.map(h => h.symbol);
                fetchAssetSummariesBulk(symbols, isManualRefresh)
                    .then(summaries => {
                        if (Object.keys(summaries).length > 0) {
                            setAssetSummaries(prev => ({ ...prev, ...summaries }));
                        }
                    })
                    .catch(() => null);
            }
            if (divRes?.data) setDividends(divRes.data);
        } catch (err) {
            console.error('Dashboard yükleme hatası:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            router.push('/login');
            return;
        }
        if (user) {
            void loadDashboardData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading]);

    // Dolar Kuru (summary'den gelen canlı kur veya varsayılan)
    const usdRate = summary?.usd_rate && summary.usd_rate > 0 ? summary.usd_rate : 48.65;

    // Para formatlama — ortak formatters kütüphanesini kullanır
    const fmt = (amountTRY: number, showPlusSign: boolean = false): string => formatCurrency(amountTRY, currency, usdRate, showPlusSign);

    // Varlık Kategorisi Sayımları (Kaç hisse, kaç fon, kaç döviz, kaç altın)
    const counts = useMemo(() => {
        let hisse = 0;
        let fon = 0;
        let altin = 0;
        let doviz = 0;
        holdings.forEach(h => {
            if (h.asset_type === 'HISSE') hisse++;
            else if (h.asset_type === 'FON') fon++;
            else if (h.asset_type === 'ALTIN') altin++;
            else if (h.asset_type === 'DOVIZ') doviz++;
        });
        return { hisse, fon, altin, doviz, total: holdings.length };
    }, [holdings]);

    // Toplam Kesilen / Hesaplanan Vergi & Komisyon Tutarı
    const taxInfo = useMemo(() => {
        let totalDividendTax = 0;
        if (dividends && Array.isArray(dividends)) {
            dividends.forEach(d => {
                const t = parseFloat(d.tax_amount || d.TaxAmount || '0');
                if (!isNaN(t)) totalDividendTax += t;
            });
        }
        const totalComm = summary?.total_commission || 0;
        return {
            totalTax: totalDividendTax,
            totalCommission: totalComm,
            totalDeductions: totalDividendTax + totalComm,
        };
    }, [dividends, summary]);

    // Periyot Listesi (TradingView & Google Finance standardı temiz butonlar)
    const dashboardPeriods: ChartPeriod[] = useMemo(() => {
        return [
            { id: '1D', label: '1G' },
            { id: '1W', label: '1H' },
            { id: '1M', label: '1A' },
            { id: '3M', label: '3A' },
            { id: '6M', label: '6A' },
            { id: 'YTD', label: 'YBB' },
            { id: '1Y', label: '1Y' },
            { id: '3Y', label: '3Y' },
            { id: '5Y', label: '5Y' },
            { id: 'ALL', label: 'Tümü' },
        ];
    }, []);

    // Zaman İçinde Portföy Gelişim Grafiği Verisi
    const chartData = useMemo(() => {
        if (!summary) return [];

        const currentVal = holdings.length > 0
            ? holdings.reduce((sum, h) => sum + (h.total_value || 0), 0) + (summary?.total_dividends || 0)
            : (summary.total_value || 0);
        const now = new Date();
        const nowMs = now.getTime();

        // Tarih sıralı ve geçerli snapshot'lar
        const sortedHistory = [...(history || [])]
            .filter(h => {
                const v = parseFloat(h.total_value);
                return !isNaN(v) && v > 0;
            })
            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

        // Portföyün gerçek başlangıç zamanı (ilk işlem tarihi, ilk snapshot veya üyelik)
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
        if (user?.created_at && !hasInception) {
            const userCreateTime = new Date(user.created_at).getTime();
            if (!isNaN(userCreateTime)) {
                inceptionTime = userCreateTime;
                hasInception = true;
            }
        }

        // 1D (Günlük) Görünümü: 5 dakikada bir (10:00 - 18:05 BIST Seans Saatleri)
        if (chartPeriod === '1D') {
            // 1D baz değeri: varlıkların dünkü fiyatından veya backend 1D değerinden alınır (ASLA total_cost'a düşmez!)
            let prevDayVal = currentVal;
            let total1dBase = 0;
            let has1dData = false;
            for (const h of holdings) {
                const sum = assetSummaries[h.symbol];
                const r1 = sum?.['1D'];
                if (r1 !== undefined && !isNaN(r1)) {
                    has1dData = true;
                    total1dBase += r1 <= -100 ? 0 : h.total_value / (1 + r1 / 100);
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
                    value: currency === 'USD' ? finalStepVal / usdRate : finalStepVal,
                    raw: finalStepVal,
                };
            });
        }

        // Periyot başlangıç baz değeri (backend hesaplamasından veya ağırlıklı varlık getirisinden)
        const periodBaseVal = (() => {
            if (chartPeriod === 'ALL') {
                return summary.total_cost > 0 ? summary.total_cost : currentVal;
            }

            const bVal = summary.period_values?.[chartPeriod];
            if (bVal && bVal > 0 && bVal !== currentVal) {
                return bVal;
            }

            // Varlıkların assetSummaries üzerinden ağırlıklı hesaplama
            let weightedBase = 0;
            let foundAny = false;
            for (const h of holdings) {
                const sum = assetSummaries[h.symbol];
                const r = sum?.[chartPeriod];
                if (r !== undefined && !isNaN(r)) {
                    foundAny = true;
                    weightedBase += r <= -100 ? 0 : h.total_value / (1 + r / 100);
                } else {
                    weightedBase += h.total_value;
                }
            }
            if (foundAny && weightedBase > 0) return weightedBase;

            // Son çare: snapshot geçmişi
            if (sortedHistory.length > 0) {
                return parseFloat(sortedHistory[0].total_value);
            }

            return currentVal;
        })();

        const effectiveBaseVal = periodBaseVal > 0 ? periodBaseVal : currentVal;

        // Hedef zamandaki portföy değerini hesaplama (interpolasyon)
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

            // İki snapshot arasına düşüyorsa ara değer bul
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

        // Zaman hedeflerini diğer finansal grafikler gibi kesintisiz ve günlük frekansla üret:
        const timeTargets: { label: string; timeMs: number }[] = [];
        let spanStartTime = nowMs;

        const formatDayLabel = (d: Date, includeYear = false): string => {
            if (includeYear) {
                return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' });
            }
            return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        };

        if (chartPeriod === '1W') {
            spanStartTime = nowMs - 7 * 86400000;
            // 1H: 30 dakikada bir (10:00 - 18:00 arası her 30 dk)
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
        } else if (chartPeriod === '1M') {
            spanStartTime = nowMs - 30 * 86400000;
            // 1A: 1 saatte bir (İş günlerinde 10:00 - 18:00 her saat başı)
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
        } else if (chartPeriod === '3M') {
            spanStartTime = nowMs - 90 * 86400000;
            // 3A: 1 saatte bir (İş günlerinde 10:00 - 18:00 her saat başı)
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
        } else if (chartPeriod === '6M') {
            spanStartTime = nowMs - 180 * 86400000;
            // 6A: Günde 2 kere (Açılış 10:00 ve Kapanış 18:00)
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
        } else if (chartPeriod === 'YTD') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
            spanStartTime = startOfYear;
            const daysSinceYearStart = Math.max(1, Math.floor((nowMs - startOfYear) / 86400000));
            // YBB: Günde 1 kere (İş günlerinde 18:00 kapanış)
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
        } else if (chartPeriod === '1Y') {
            spanStartTime = nowMs - 365 * 86400000;
            // 1Y: Günde 1 kere (İş günlerinde 18:00 kapanış)
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
        } else if (chartPeriod === '3Y') {
            spanStartTime = nowMs - 3 * 365 * 86400000;
            // 3Y: Haftada bir (Cuma günleri seans kapanışı 18:00)
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
            // 5Y: Ayda bir (Her ayın 15'i saat 18:00)
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

        // Doğal Aralık (Inception Date) Kısıtlaması:
        // Eğer seçilen periyot (örn 1Y, 5Y) kullanıcının gerçek portföy başlangıcından daha eskiyse,
        // grafiği kullanıcının başlangıç tarihine kilitleriz (öncesine sahte çizgi çizilmez).
        const effectiveStartTime = hasInception ? Math.max(spanStartTime, inceptionTime) : spanStartTime;

        let filteredTargets = timeTargets.filter(t => t.timeMs >= effectiveStartTime - (4 * 3600 * 1000));

        // Eğer aralık kısıtlandığı için hiç nokta kalmadıysa veya 1 nokta kaldıysa en az 2 nokta sağla:
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
            // İlk hedef nokta ile portföy başlangıcı arasında boşluk varsa başlangıç noktasını en başa oturt
            filteredTargets.unshift({
                label: formatDayLabel(new Date(effectiveStartTime)),
                timeMs: effectiveStartTime
            });
        }

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
                value: currency === 'USD' ? val / usdRate : val,
                raw: val,
            };
        });
    }, [summary, history, chartPeriod, currency, usdRate, holdings, assetSummaries, user]);

    // Kategori Dağılım Grafiği Verisi (Donut) — Varlık Sınıfına Özgü Belirgin Finansal Renkler
    const categoryData = useMemo(() => {
        if (!summary || !summary.breakdown) return [];
        const b = summary.breakdown;
        const items = [
            { name: 'Hisse Senedi', key: 'HISSE', value: b.HISSE?.value || 0, color: '#1A9FD3' }, // Cyan Mavi
            { name: 'Yatırım Fonu', key: 'FON', value: b.FON?.value || 0, color: '#8B5CF6' },   // Violet Mor
            { name: 'Gram Altın', key: 'ALTIN', value: b.ALTIN?.value || 0, color: '#F59E0B' },  // Altın Kehribar
            { name: 'Döviz', key: 'DOVIZ', value: b.DOVIZ?.value || 0, color: '#10B981' },       // Zümrüt Yeşili
        ].filter(item => item.value > 0);

        const total = items.reduce((acc, it) => acc + it.value, 0);
        return items.map(it => ({
            ...it,
            percent: total > 0 ? (it.value / total) * 100 : 0,
            displayValue: currency === 'USD' ? it.value / usdRate : it.value,
        }));
    }, [summary, currency, usdRate]);

    // Kategori Kâr / Zarar Karşılaştırma Grafiği
    const categoryPerformanceData = useMemo(() => {
        if (!summary || !summary.breakdown) return [];
        const b = summary.breakdown;
        return [
            { name: 'Hisse', pnl: b.HISSE?.profit_loss || 0, cost: b.HISSE?.cost || 0 },
            { name: 'Fon', pnl: b.FON?.profit_loss || 0, cost: b.FON?.cost || 0 },
            { name: 'Altın', pnl: b.ALTIN?.profit_loss || 0, cost: b.ALTIN?.cost || 0 },
            { name: 'Döviz', pnl: b.DOVIZ?.profit_loss || 0, cost: b.DOVIZ?.cost || 0 },
        ].map(it => {
            const pnlDisplay = currency === 'USD' ? it.pnl / usdRate : it.pnl;
            const pnlPercent = it.cost > 0 ? (it.pnl / it.cost) * 100 : 0;
            return {
                name: it.name,
                pnl: pnlDisplay,
                rawPnl: it.pnl,
                pnlPercent,
            };
        });
    }, [summary, currency, usdRate]);

    if (authLoading || loading) {
        return <LoadingSpinner withLogo message="Portföy verileri yükleniyor..." />;
    }

    const totalDividends = summary?.total_dividends || 0;
    const equityVal = holdings.length > 0
        ? holdings.reduce((sum, h) => sum + (h.total_value || 0), 0)
        : (summary?.total_equity_value ?? summary?.total_value ?? 0);
    // Toplam Portföy Değeri = Açık Hisse/Fon Varlıkları + Nakit Temettü Gelirleri
    const totalVal = equityVal + totalDividends;
    const totalCost = summary?.total_cost || 0;
    const realizedPnL = summary?.realized_profit_loss || 0;
    const capitalPnl = summary?.capital_profit_loss || 0;

    // Toplam Portföy Getirisi (Sermaye Kazancı + Nakit Temettü + Gerçekleşen Kâr/Zarar)
    const totalCombinedProfit = summary?.total_combined_profit !== undefined
        ? summary.total_combined_profit
        : (capitalPnl + totalDividends + realizedPnL);

    const totalReturnPct = summary?.total_return_percentage !== undefined
        ? summary.total_return_percentage
        : (totalCost > 0 ? (totalCombinedProfit / totalCost) * 100 : 0);

    const isProfit = totalCombinedProfit >= 0;

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                {/* 1. ÜST BAŞLIK VE HIZLI EYLEMLER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Portföy Genel Bakış
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                15 Dk. Gecikmeli
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            Hoş geldiniz, <span className="text-slate-200 font-semibold">{user?.username}</span>. Portföyünüzün anlık durumu ve varlık analizleri.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Para Birimi Dönüştürücü (TRY / USD) */}
                        <button
                            onClick={toggleCurrency}
                            title="Tüm değerleri Dolar veya TL cinsinden görüntüle"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm border bg-slate-800 border-slate-700 hover:border-[#1A9FD3] hover:text-[#1A9FD3] active:scale-95 cursor-pointer text-slate-100"
                        >
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-200">
                                {currency}
                            </span>
                            <span>Para Birimi:</span>
                            <span className="px-2 py-0.5 rounded-md font-extrabold bg-[#1A9FD3]/15 text-[#1A9FD3]">
                                {currency === 'TRY' ? '₺ TRY' : '$ USD'}
                            </span>
                        </button>

                        {/* Yenile Butonu */}
                        <button
                            onClick={() => loadDashboardData(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3] transition disabled:opacity-50 cursor-pointer"
                            title="Portföyü Yenile (Önbelleği Temizle)"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-400' : ''}`} />
                        </button>

                        {/* Varlıklarım Sayfasına Geçiş Butonu */}
                        <Link
                            href="/holdings"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20"
                        >
                            <Layers className="w-4 h-4" />
                            <span>Varlıklarımı Yönet & Grupla</span>
                            <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>
                    </div>
                </div>

                {/* 2. ÖZET İSTATİSTİK KARTLARI — HİYERARŞİK DÜZEN (DOMINANT HERO KART + 3 İKİNCİL KART) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
                    {/* BÜYÜK BASKIN KART: Toplam Portföy Değeri (Sayfanın Başrolü) */}
                    <div className="lg:col-span-12 xl:col-span-5 bg-slate-900 border border-slate-800/90 rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                <span>Toplam Portföy Değeri</span>
                                <Briefcase className="w-4 h-4 text-slate-400" />
                            </div>
                            <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight tabular-nums py-1">
                                {fmt(totalVal)}
                            </p>
                            <p className="text-sm text-slate-400 mt-2 tabular-nums font-mono">
                                {currency === 'TRY'
                                    ? `$ ${(totalVal / usdRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (USD Karşılığı)`
                                    : `${totalVal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ (TL Karşılığı)`
                                }
                            </p>
                            {totalDividends > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                                    <span className="text-slate-400">
                                        Varlıklar: <strong className="text-slate-300 font-mono font-medium">{fmt(equityVal)}</strong>
                                    </span>
                                    <span className="text-slate-400">
                                        Nakit Temettü: <strong className="font-semibold text-emerald-400 font-mono tabular-nums">+{fmt(totalDividends)}</strong>
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Canlı Kur:</span>
                            <span className="font-semibold text-slate-300 font-mono">1 $ = {usdRate.toFixed(2)} ₺</span>
                        </div>
                    </div>

                    {/* DİĞER 3 İKİNCİL KART */}
                    <div className="lg:col-span-12 xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* KART 2: Toplam Net Getiri (Sermaye + Temettü + Satış Kârı) */}
                        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                                <span>Toplam Getiri (Net K/Z)</span>
                                {isProfit ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-rose-400" />
                                )}
                            </div>
                            <div>
                                <p className={`text-xl sm:text-2xl font-black tracking-tight tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fmt(totalCombinedProfit, true)}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded font-mono tabular-nums ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {totalCombinedProfit >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                                    </span>
                                    <span className="text-xs text-slate-400">Toplam Getiri</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                                <div className="flex justify-between items-center text-slate-400">
                                    <span>Maliyet:</span>
                                    <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(totalCost)}</span>
                                </div>
                                {totalDividends > 0 && (
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span className="text-emerald-400/90">Temettü:</span>
                                        <span className="font-semibold text-emerald-400 font-mono tabular-nums">+{fmt(totalDividends)}</span>
                                    </div>
                                )}
                                {realizedPnL !== 0 && (
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span>Satış K/Z:</span>
                                        <span className={`font-semibold font-mono tabular-nums ${realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {fmt(realizedPnL, true)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* KART 3: Vergi ve Kesintiler (Sade nötr görünüm) */}
                        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                                <span>Vergi & Komisyon</span>
                                <Receipt className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xl sm:text-2xl font-black text-slate-200 tracking-tight tabular-nums">
                                    {fmt(taxInfo.totalDeductions)}
                                </p>
                                <p className="text-xs text-slate-400 mt-2 line-clamp-1">
                                    Stopaj + Komisyon
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Stopaj:</span>
                                    <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(taxInfo.totalTax)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Komisyon:</span>
                                    <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(taxInfo.totalCommission)}</span>
                                </div>
                            </div>
                        </div>

                        {/* KART 4: Varlık Dağılımı (Sade nötr görünüm) */}
                        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                                <span>Varlık Dağılımı</span>
                                <Layers className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
                                    {counts.total} <span className="text-sm font-medium text-slate-400">Varlık</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-2 line-clamp-1">
                                    Portföydeki varlıklar
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-xs">
                                <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                                    <span className="text-slate-400 font-medium">Hisse:</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{counts.hisse}</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                                    <span className="text-slate-400 font-medium">Fon:</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{counts.fon}</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                                    <span className="text-slate-400 font-medium">Altın:</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{counts.altin}</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
                                    <span className="text-slate-400 font-medium">Döviz:</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{counts.doviz}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. PORTFÖY DEĞER GELİŞİM GRAFİĞİ (İNTERAKTİF BİLEŞEN) */}
                <InteractiveAreaChart
                    title="Portföy Değer Gelişimi"
                    subtitle="Seçilen periyotta portföyünüzün büyüme grafiği ve dönemsel performansı"
                    data={chartData}
                    dataKey="value"
                    dateKey="date"
                    periods={dashboardPeriods}
                    activePeriod={chartPeriod}
                    onPeriodChange={(p) => setChartPeriod(p)}
                    currencySymbol={currency === 'USD' ? '$' : '₺'}
                    currency={currency}
                    valueFormatter={(val) => fmt(currency === 'USD' ? val * usdRate : val)}
                    showBrush={true}
                    showStats={true}
                    isLoading={loading || refreshing}
                />

                {/* 4. İKİ KOLONLU GRAFİK ALANI: DAĞILIM VE PERFORMANS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* SOL: Kategori Dağılımı Donut Grafiği */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                            <div className="flex items-center gap-2">
                                <PieIcon className="w-5 h-5 text-slate-400" />
                                <h3 className="text-base font-bold text-white">Varlık Sınıfı Dağılımı</h3>
                            </div>
                            <span className="text-xs text-slate-400">Yüzdesel Pay</span>
                        </div>

                        {categoryData.length > 0 ? (
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <div className="w-48 h-48 relative shrink-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={75}
                                                paddingAngle={4}
                                                dataKey="value"
                                                isAnimationActive={false}
                                            >
                                                {categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#fff' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                                                formatter={(val) => [fmt(Number(val)), 'Değer']}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="flex-1 w-full space-y-2.5">
                                    {categoryData.map(c => (
                                        <div key={c.key} className="flex items-center justify-between bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                                                <span className="text-xs font-semibold text-slate-200">{c.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-white tabular-nums">{fmt(c.value)}</p>
                                                <p className="text-xs text-slate-400 font-mono tabular-nums">%{c.percent.toFixed(1)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                Portföyünüzde henüz dağılım oluşturacak varlık bulunmuyor.
                            </div>
                        )}
                    </div>

                    {/* SAĞ: Kategori Kâr / Zarar Karşılaştırma Bar Grafiği */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-slate-400" />
                                <h3 className="text-base font-bold text-white">Kategori Kâr / Zarar Getirisi</h3>
                            </div>
                            <span className="text-xs text-slate-400">{currency === 'TRY' ? 'TL Bazında' : 'Dolar Bazında'}</span>
                        </div>

                        {categoryPerformanceData.some(c => c.rawPnl !== 0) ? (
                            <div className="w-full h-48 sm:h-52">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                    <BarChart data={categoryPerformanceData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                            tickFormatter={val => {
                                                if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
                                                if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
                                                return val;
                                            }}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                borderColor: '#334155',
                                                borderRadius: '0.5rem',
                                                color: '#ffffff',
                                                fontSize: '0.8rem',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                            }}
                                            itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
                                            labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: '4px' }}
                                            formatter={(val) => [
                                                currency === 'USD' ? `$ ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `₺ ${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                                                'Kâr / Zarar',
                                            ]}
                                        />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                            {categoryPerformanceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.rawPnl >= 0 ? '#10b981' : '#f43f5e'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                Henüz kâr/zarar oluşturacak kapanmış veya değerlenmiş pozisyon yok.
                            </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>Yeşil: Kâr • Kırmızı: Zarar</span>
                            <Link href="/holdings" className="text-[#1A9FD3] hover:text-[#1589B7] font-semibold transition flex items-center gap-1">
                                Detaylı Varlık Listesi <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 5. VARLIKLARIM HIZLI GEÇİŞ ÇAĞRISI */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Hisselerinizi Gruplayın ve Sıralayın</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                            Varlıklarınızı özel gruplara (Temettü, Büyüme, Teknoloji vb.) ayırabilir, grup bazlı kâr/zarar performansınızı takip edebilir ve 1D, 1W, 1M periyotlarına göre sıralayabilirsiniz.
                        </p>
                    </div>
                    <Link
                        href="/holdings"
                        className="px-6 py-3 rounded-xl bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold text-xs transition shadow-sm shadow-[#1A9FD3]/20 shrink-0"
                    >
                        Varlıklarımı Yönet & Grupla →
                    </Link>
                </div>

                {/* 6. VERİ KAYNAĞI VE YASAL UYARI DİPNOTU */}
                <div className="pt-2 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-slate-800/60 font-mono">
                    <p>
                        * Portföy değerleri 15 dk gecikmeli BIST ve resmi TEFAS takas verilerine dayanır. Bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
                    </p>
                    <Link href="/disclaimer" className="text-slate-400 hover:text-slate-200 underline transition shrink-0">
                        Yasal Uyarı &amp; Çekince
                    </Link>
                </div>
            </div>
        </div>
    );
}