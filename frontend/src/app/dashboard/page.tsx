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
    const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');

    // Portföy grafik periyodu: 1D (Günlük), 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, ALL
    const [chartPeriod, setChartPeriod] = useState<string>('1M');

    // Sayfa ilk açıldığında localStorage'dan para birimi tercihini al
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('preferred_currency');
            if (saved === 'USD' || saved === 'TRY') {
                setCurrency(saved);
            }
        }
    }, []);

    const toggleCurrency = () => {
        const next = currency === 'TRY' ? 'USD' : 'TRY';
        setCurrency(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferred_currency', next);
        }
    };

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
                api.get<any[]>('/dividends').catch(() => null),
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
            setLoading(false);
            router.push('/login');
            return;
        }
        if (user) {
            loadDashboardData();
        }
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

    // Dönemsel Getiri Oranları Listesi (Buton altındaki rozetler için)
    const dashboardPeriods: ChartPeriod[] = useMemo(() => {
        if (!summary) return [];
        const currentVal = summary.total_value;
        const now = Date.now();

        // Tarih sıralı ve geçerli snapshot listesi
        const sortedHistory = [...(history || [])]
            .filter(h => {
                const v = parseFloat(h.total_value);
                return !isNaN(v) && v > 0;
            })
            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

        const earliestSnapshot = sortedHistory.length > 0 ? sortedHistory[0] : null;
        const earliestVal = earliestSnapshot ? parseFloat(earliestSnapshot.total_value) : currentVal;
        const earliestTime = earliestSnapshot ? new Date(earliestSnapshot.recorded_at).getTime() : now;

        // Belirli bir zaman damgasına en yakın portföy değerini bulma
        const getValAtTime = (targetTime: number): number => {
            if (sortedHistory.length === 0) {
                return currentVal;
            }
            if (targetTime <= earliestTime) {
                return earliestVal;
            }
            let closestVal = earliestVal;
            let minDiff = Infinity;
            for (const h of sortedHistory) {
                const t = new Date(h.recorded_at).getTime();
                const diff = Math.abs(t - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    const parsed = parseFloat(h.total_value);
                    if (!isNaN(parsed) && parsed > 0) closestVal = parsed;
                }
            }
            return closestVal;
        };

        const calcReturn = (pastVal: number | null): number | null => {
            if (pastVal === null || pastVal <= 0 || currentVal <= 0) return null;
            return ((currentVal - pastVal) / pastVal) * 100;
        };

        // 1D: Varlıkların assetSummaries üzerinden ağırlıklı hesaplama desteği
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
        const calc1dReturn = has1dData && total1dBase > 0 ? ((currentVal - total1dBase) / total1dBase) * 100 : 0;

        let val1D = getValAtTime(now - 86400000);
        if (val1D === currentVal && sortedHistory.length > 1) {
            val1D = parseFloat(sortedHistory[sortedHistory.length - 2].total_value);
        }

        const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
        const pr = summary.period_returns;

        const ret1D = (pr?.['1D'] !== undefined && pr['1D'] !== 0)
            ? pr['1D']
            : (has1dData ? calc1dReturn : calcReturn(val1D));

        const ret1W = pr?.['1W'] !== undefined && pr['1W'] !== 0 ? pr['1W'] : calcReturn(getValAtTime(now - 7 * 86400000));
        const ret1M = pr?.['1M'] !== undefined && pr['1M'] !== 0 ? pr['1M'] : calcReturn(getValAtTime(now - 30 * 86400000));
        const ret3M = pr?.['3M'] !== undefined && pr['3M'] !== 0 ? pr['3M'] : calcReturn(getValAtTime(now - 90 * 86400000));
        const ret6M = pr?.['6M'] !== undefined && pr['6M'] !== 0 ? pr['6M'] : calcReturn(getValAtTime(now - 180 * 86400000));
        const retYTD = pr?.['YTD'] !== undefined && pr['YTD'] !== 0 ? pr['YTD'] : calcReturn(getValAtTime(startOfYear));
        const ret1Y = pr?.['1Y'] !== undefined && pr['1Y'] !== 0 ? pr['1Y'] : calcReturn(getValAtTime(now - 365 * 86400000));
        const ret3Y = pr?.['3Y'] !== undefined && pr['3Y'] !== 0 ? pr['3Y'] : calcReturn(getValAtTime(now - 3 * 365 * 86400000));
        const ret5Y = pr?.['5Y'] !== undefined ? pr['5Y'] : (pr?.['ALL'] !== undefined ? pr['ALL'] : summary.capital_profit_loss_percentage);

        return [
            { id: '1D', label: '1G', changePercent: ret1D },
            { id: '1W', label: '1H', changePercent: ret1W },
            { id: '1M', label: '1A', changePercent: ret1M },
            { id: '3M', label: '3A', changePercent: ret3M },
            { id: '6M', label: '6A', changePercent: ret6M },
            { id: 'YTD', label: 'YBB', changePercent: retYTD },
            { id: '1Y', label: '1Y', changePercent: ret1Y },
            { id: '3Y', label: '3Y', changePercent: ret3Y },
            { id: 'ALL', label: 'Tümü', changePercent: ret5Y },
        ];
    }, [summary, history, holdings, assetSummaries]);

    // Zaman İçinde Portföy Gelişim Grafiği Verisi
    const chartData = useMemo(() => {
        if (!summary) return [];

        const currentVal = summary.total_value;
        const now = new Date();
        const nowMs = now.getTime();

        // Tarih sıralı ve geçerli snapshot'lar
        const sortedHistory = [...(history || [])]
            .filter(h => {
                const v = parseFloat(h.total_value);
                return !isNaN(v) && v > 0;
            })
            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

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

        // Zaman hedeflerini kullanıcının istediği frekanslara göre üret:
        const timeTargets: { label: string; timeMs: number }[] = [];
        let spanStartTime = nowMs;

        if (chartPeriod === '1W') {
            spanStartTime = nowMs - 7 * 86400000;
            for (let d = 7; d >= 0; d--) {
                const dayDate = new Date(nowMs - d * 86400000);
                const dayOfWeek = dayDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;
                const dayLabel = dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                for (let h = 10; h <= 18; h += 2) {
                    const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, 0);
                    timeTargets.push({
                        label: `${dayLabel} ${String(h).padStart(2, '0')}:00`,
                        timeMs: pt.getTime()
                    });
                }
            }
        } else if (chartPeriod === '1M' || chartPeriod === '3M') {
            const totalDays = chartPeriod === '1M' ? 30 : 90;
            spanStartTime = nowMs - totalDays * 86400000;
            for (let d = totalDays; d >= 0; d -= (chartPeriod === '1M' ? 1 : 2)) {
                const dayDate = new Date(nowMs - d * 86400000);
                const dayOfWeek = dayDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    timeMs: pt.getTime()
                });
            }
        } else if (chartPeriod === '6M') {
            spanStartTime = nowMs - 180 * 86400000;
            for (let d = 180; d >= 0; d -= 5) {
                const dayDate = new Date(nowMs - d * 86400000);
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    timeMs: pt.getTime()
                });
            }
        } else if (chartPeriod === 'YTD') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
            spanStartTime = startOfYear;
            const daysSinceYearStart = Math.max(1, Math.floor((nowMs - startOfYear) / 86400000));
            const step = Math.max(1, Math.floor(daysSinceYearStart / 30));
            for (let d = daysSinceYearStart; d >= 0; d -= step) {
                const dayDate = new Date(nowMs - d * 86400000);
                const dayOfWeek = dayDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    timeMs: pt.getTime()
                });
            }
        } else if (chartPeriod === '1Y') {
            spanStartTime = nowMs - 365 * 86400000;
            for (let d = 365; d >= 0; d -= 7) {
                const dayDate = new Date(nowMs - d * 86400000);
                const pt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 18, 0);
                timeTargets.push({
                    label: d === 0 ? 'Bugün' : dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    timeMs: pt.getTime()
                });
            }
        } else if (chartPeriod === '3Y') {
            spanStartTime = nowMs - 3 * 365 * 86400000;
            for (let w = 156; w >= 0; w -= 4) {
                const weekDate = new Date(nowMs - w * 7 * 86400000);
                const pt = new Date(weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate(), 18, 0);
                timeTargets.push({
                    label: w === 0 ? 'Bugün' : weekDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' }),
                    timeMs: pt.getTime()
                });
            }
        } else { // 'ALL'
            spanStartTime = nowMs - 5 * 365 * 86400000;
            for (let m = 60; m >= 0; m -= 3) {
                const mDate = new Date(now.getFullYear(), now.getMonth() - m, 15, 18, 0);
                timeTargets.push({
                    label: m === 0 ? 'Bugün' : mDate.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
                    timeMs: mDate.getTime()
                });
            }
        }

        const usedLabels = new Set<string>();
        return timeTargets.map((item, idx) => {
            let label = item.label;
            if (usedLabels.has(label)) {
                label = `${label} (${idx})`;
            }
            usedLabels.add(label);

            let val = interpolateVal(item.timeMs, spanStartTime);
            if (idx === 0 && effectiveBaseVal > 0) {
                val = effectiveBaseVal;
            } else if (idx === timeTargets.length - 1) {
                val = currentVal;
            }

            return {
                date: label,
                value: currency === 'USD' ? val / usdRate : val,
                raw: val,
            };
        });
    }, [summary, history, chartPeriod, currency, usdRate, holdings, assetSummaries]);

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

    const totalVal = summary?.total_value || 0;
    const totalCost = summary?.total_cost || 0;
    const totalPnl = summary?.capital_profit_loss || 0;
    const totalPnlPct = summary?.capital_profit_loss_percentage || 0;
    const isProfit = totalPnl >= 0;

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
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#1A9FD3]/10 text-[#1A9FD3] border border-[#1A9FD3]/20">
                                Canlı
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            Hoş geldiniz, <span className="text-slate-200 font-semibold">{user?.username}</span>. Portföyünüzün anlık durumu ve varlık analizleri.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* 🔘 TEK TIKLA PARA BİRİMİ DÖNÜŞTÜRÜCÜ (TRY ⇄ USD) */}
                        <button
                            onClick={toggleCurrency}
                            title="Tüm değerleri Dolar veya TL cinsinden görüntüle"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm border bg-slate-800 border-slate-700 hover:border-[#1A9FD3] hover:text-[#1A9FD3] active:scale-95 cursor-pointer text-slate-100"
                        >
                            <span className="text-base">{currency === 'TRY' ? '🇹🇷' : '🇺🇸'}</span>
                            <span>Para Birimi:</span>
                            <span className={`px-2 py-0.5 rounded-md font-extrabold ${currency === 'TRY' ? 'bg-[#1A9FD3]/15 text-[#1A9FD3]' : 'bg-[#1A9FD3]/15 text-[#1A9FD3]'}`}>
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
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1A9FD3]' : ''}`} />
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
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Canlı Kur:</span>
                            <span className="font-semibold text-slate-300 font-mono">1 $ = {usdRate.toFixed(2)} ₺</span>
                        </div>
                    </div>

                    {/* DİĞER 3 İKİNCİL KART */}
                    <div className="lg:col-span-12 xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* KART 2: Net Kâr / Zarar */}
                        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                                <span>Net Kâr / Zarar</span>
                                {isProfit ? (
                                    <TrendingUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <p className={`text-xl sm:text-2xl font-black tracking-tight tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fmt(totalPnl, true)}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded font-mono tabular-nums ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                                    </span>
                                    <span className="text-xs text-slate-400">Getiri</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                <span className="text-slate-400">Maliyet:</span>
                                <span className="font-semibold text-slate-300 font-mono tabular-nums">{fmt(totalCost)}</span>
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
                                <PieIcon className="w-5 h-5 text-[#1A9FD3]" />
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
                                            >
                                                {categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#fff' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                                                formatter={(val: any) => [fmt(Number(val)), 'Değer']}
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
                                <BarChart3 className="w-5 h-5 text-emerald-400" />
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
                                            formatter={(val: any) => [
                                                currency === 'USD' ? `$ ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `₺ ${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                                                'Kâr / Zarar',
                                            ]}
                                        />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
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
            </div>
        </div>
    );
}