'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageContainer from '@/components/ui/PageContainer';
import { InteractiveAreaChart, type ChartDataPoint, type ChartPeriodResult } from '@/components/InteractiveAreaChart';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import PortfolioHero, { type DayChange } from '@/components/dashboard/PortfolioHero';
import SummaryCards, { DashboardDetails, type DashboardTotals } from '@/components/dashboard/SummaryCards';
import AllocationDonutCard from '@/components/dashboard/AllocationDonutCard';
import CategoryPnlCard from '@/components/dashboard/CategoryPnlCard';
import HoldingsGlance from '@/components/dashboard/HoldingsGlance';
import { getHoldingRowMetrics } from '@/components/holdings/holdingRowMetrics';
import { buildPortfolioChartData } from '@/components/dashboard/portfolioChartData';
import { formatCurrency } from '@/lib/formatters';
import { CHART_PERIODS } from '@/lib/periodUtils';
import { useCurrency, type Currency } from '@/hooks/useCurrency';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { usePortfolioValueHistory } from '@/hooks/usePortfolioValueHistory';

// "Bugün" satırı seçili grafik döneminden bağımsız olarak 1G geçmişinden gelir
const HERO_RANGES: readonly string[] = ['1D'];

// Kaydırıcıyla daraltılan aralığın K/Z'si: aralık sonu ile başındaki K/Z farkı, yüzde aralık sonundaki maliyete göre
function rangeResultFor(first: ChartDataPoint, last: ChartDataPoint): ChartPeriodResult | null {
    const startPnl = Number(first.pnl);
    const endPnl = Number(last.pnl);
    const endCost = Number(last.cost);
    if (!Number.isFinite(startPnl) || !Number.isFinite(endPnl)) return null;
    const amount = endPnl - startPnl;
    return { amount, pct: endCost > 0 ? (amount / endCost) * 100 : 0 };
}

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const { summary, holdings, dividends, assetSummaries, usdRate, loading, refreshing, loadError, reload } =
        usePortfolioData(user, { withDividends: true });

    const { currency, toggleCurrency } = useCurrency();
    // Kur alınamadıysa USD seçili olsa bile tutarlar TL gösterilir
    const displayCurrency: Currency = usdRate !== null ? currency : 'TRY';
    const usdDivisor = displayCurrency === 'USD' ? usdRate : null;

    // Grafik periyodu: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y
    const [chartPeriod, setChartPeriod] = useState<string>('1M');

    // Portföyün değer ve K/Z geçmişi; dönem başına bir kez çekilir, yenile düğmesiyle tazelenir.
    // 1G her durumda yüklenir: üstteki "Bugün" onunla aynı sayıyı gösterir.
    const { state: valueHistory, stateFor: valueHistoryFor, refresh: refreshValueHistory } =
        usePortfolioValueHistory(chartPeriod, !!user, HERO_RANGES);
    const dayHistory = valueHistoryFor('1D');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fmt = useCallback(
        (amountTRY: number, showPlusSign: boolean = false): string => formatCurrency(amountTRY, currency, usdRate, showPlusSign),
        [currency, usdRate]
    );

    // Toplam değer = açık pozisyonlar + nakit temettü
    const totalDividends = summary?.total_dividends || 0;
    const equityVal = holdings.length > 0
        ? holdings.reduce((sum, h) => sum + (h.total_value || 0), 0)
        : (summary?.total_equity_value ?? summary?.total_value ?? 0);
    const totalVal = equityVal + totalDividends;
    const totalCost = summary?.total_cost || 0;
    const realizedPnL = summary?.realized_profit_loss || 0;
    const capitalPnl = summary?.capital_profit_loss || 0;

    // Toplam getiri = sermaye K/Z + nakit temettü + gerçekleşen K/Z
    const totalCombinedProfit = summary?.total_combined_profit !== undefined
        ? summary.total_combined_profit
        : (capitalPnl + totalDividends + realizedPnL);

    const totalReturnPct = summary?.total_return_percentage !== undefined
        ? summary.total_return_percentage
        : (totalCost > 0 ? (totalCombinedProfit / totalCost) * 100 : 0);

    const totals: DashboardTotals = {
        totalVal,
        equityVal,
        totalDividends,
        totalCost,
        realizedPnL,
        totalCombinedProfit,
        totalReturnPct,
        totalCommission: summary?.total_commission || 0,
    };

    // Grafik: sunucudaki geçmişten birikimli kâr/zarar (pnl). Değer çizilmiyor: para yatırma/çekme ve satışlar
    // değeri oynatıyor, çizgi üstteki K/Z satırıyla çelişiyordu. 2 noktadan azsa çizilmez.
    const historyPoints = valueHistory.status === 'ready' ? valueHistory.data.points : null;
    const chartData = useMemo(
        () => historyPoints && historyPoints.length >= 2
            ? buildPortfolioChartData(historyPoints, chartPeriod, usdDivisor)
            : [],
        [historyPoints, chartPeriod, usdDivisor]
    );

    // Dönem K/Z'si sunucudan gelir (alım/satım nakit akışları hariç); USD'de yalnızca tutar çevrilir
    const chartPeriodResult = useMemo<ChartPeriodResult | undefined>(() => {
        if (valueHistory.status !== 'ready' || chartData.length < 2) return undefined;
        const { pnl_change, pnl_change_pct } = valueHistory.data;
        return { amount: usdDivisor ? pnl_change / usdDivisor : pnl_change, pct: pnl_change_pct };
    }, [valueHistory, chartData.length, usdDivisor]);

    // 1G'de önceki kapanıştaki K/Z nokta değil kesikli referans çizgisi olarak çizilir
    const chartReference = useMemo<number | null>(() => {
        if (chartPeriod !== '1D' || valueHistory.status !== 'ready' || !valueHistory.data.baseline) return null;
        const pnl = valueHistory.data.baseline.pnl;
        return usdDivisor ? pnl / usdDivisor : pnl;
    }, [chartPeriod, valueHistory, usdDivisor]);

    const chartEmptyMessage =
        valueHistory.status === 'ready' ? 'Grafik için yeterli işlem geçmişi yok'
            : valueHistory.status === 'unavailable' ? 'Portföy geçmişi henüz hazır değil'
                : 'Portföy geçmişi alınamadı';

    // Grafik değerleri gösterilen para biriminde; fmt TL beklediği için USD'de kurla geri çevrilir
    const chartValueFormatter = useCallback(
        (val: number) => fmt(usdDivisor ? val * usdDivisor : val),
        [fmt, usdDivisor]
    );

    // Günlük değişim: grafikteki 1G K/Z'siyle aynı kaynak (value-history 1D, önceki kapanışa göre; seans günü
    // ödenen temettü dahil). 1G yüklenene kadar ya da alınamazsa eski yaklaşık hesap: varlıkların 1G getirileri,
    // o da yoksa portföyün günlük kayıtları.
    const dayChange = useMemo<DayChange | null>(() => {
        if (dayHistory.status === 'ready') {
            const d = dayHistory.data;
            if (d.baseline || d.points.length >= 2) {
                return { amount: d.pnl_change, pct: d.pnl_change_pct };
            }
        }
        let amount = 0;
        let base = 0;
        let hasAny = false;
        for (const h of holdings) {
            const { periodPnl } = getHoldingRowMetrics(h, '1D', assetSummaries);
            if (periodPnl === null) continue;
            hasAny = true;
            amount += periodPnl;
            base += h.total_value - periodPnl;
        }
        if (hasAny && base > 0) return { amount, pct: (amount / base) * 100 };
        const pct = summary?.period_returns?.['1D'];
        if (pct !== undefined && pct !== 0 && pct > -100) {
            return { pct, amount: equityVal * (pct / (100 + pct)) };
        }
        return null;
    }, [dayHistory, holdings, assetSummaries, summary, equityVal]);

    if (authLoading || loading) {
        return <LoadingSpinner withLogo message="Portföy verileri yükleniyor..." />;
    }

    // Özet ya da varlık listesi gelmediyse kartlar sıfır veya eksik görünür; kullanıcıyı uyar.
    // Özet açık pozisyon sayısını veriyor, liste boş geldiyse varlık verisi eksik demektir.
    const showLoadError = loadError || !summary || (summary.holdings_count > 0 && holdings.length === 0);

    return (
        <PageContainer>
            <DashboardHeader
                username={user?.username}
                refreshing={refreshing}
                onRefresh={() => {
                    refreshValueHistory();
                    void reload(true);
                }}
            />

            {showLoadError && (
                <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-loss-soft text-loss text-sm leading-relaxed">
                    <AlertCircle className="size-[18px] shrink-0 mt-0.5" aria-hidden />
                    <span>Portföy verileri sunucudan alınamadı, gösterilen tutarlar eksik ya da güncel olmayabilir. Üstteki yenile düğmesiyle tekrar deneyebilirsiniz.</span>
                </div>
            )}

            {/* Odak: toplam değer, değişim satırı ve portföy grafiği; hemen altında tek özet şeridi */}
            <div className="flex flex-col gap-6">
                <PortfolioHero
                    totals={totals}
                    fmt={fmt}
                    currency={displayCurrency}
                    usdRate={usdRate}
                    onToggleCurrency={toggleCurrency}
                    dayChange={dayChange}
                >
                    <div className="flex flex-col gap-1">
                        <InteractiveAreaChart
                            frameless
                            title="Kâr/zarar"
                            data={chartData}
                            dataKey="pnl"
                            dateKey="date"
                            periods={CHART_PERIODS}
                            activePeriod={chartPeriod}
                            onPeriodChange={setChartPeriod}
                            currencySymbol={displayCurrency === 'USD' ? '$' : '₺'}
                            currency={displayCurrency}
                            valueFormatter={chartValueFormatter}
                            showBrush={true}
                            showStats={true}
                            isLoading={valueHistory.status === 'loading'}
                            emptyMessage={chartEmptyMessage}
                            periodResult={chartPeriodResult}
                            referenceValue={chartReference}
                            referenceLabel="Önceki kapanış"
                            rangeResultFor={rangeResultFor}
                            // Çizgi K/Z'nin dönem içindeki yönüne göre yeşil/kırmızı: üstteki ▲/▼ satırıyla aynı rengi verir
                            signed
                            minLabel="En düşük K/Z"
                            maxLabel="En yüksek K/Z"
                            lineTone="auto"
                            height={280}
                        />
                    </div>
                </PortfolioHero>
                <SummaryCards
                    holdings={holdings}
                    dividends={dividends}
                    totals={totals}
                    fmt={fmt}
                />
            </div>

            {/* Masaüstünde ana sütunda pozisyonlar, dar yan sütunda dağılım ve kategori K/Z */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-10">
                <HoldingsGlance
                    holdings={holdings}
                    assetSummaries={assetSummaries}
                    fmt={fmt}
                    equityVal={equityVal}
                    className="lg:basis-0 lg:grow"
                />

                <div className="flex flex-col gap-10 min-w-0 lg:w-[340px] shrink-0">
                    <AllocationDonutCard breakdown={summary?.breakdown} fmt={fmt} />
                    <CategoryPnlCard breakdown={summary?.breakdown} fmt={fmt} usdDivisor={usdDivisor} />
                </div>
            </div>

            <DashboardDetails
                dividends={dividends}
                totals={totals}
                fmt={fmt}
                usdRate={usdRate}
            />

            {/* Veri kaynağı ve yasal uyarı */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-x-4 gap-y-1 text-xs text-fg-muted">
                <p className="leading-relaxed max-w-4xl">
                    * BIST fiyatları en az 15 dakika gecikmelidir; fon fiyatları TEFAS&apos;ta yayımlanan günlük fiyatlardır, altın ve döviz kurları gösterge niteliğindedir. Bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
                </p>
                <Link
                    href="/disclaimer"
                    className="inline-flex items-center min-h-11 sm:min-h-10 shrink-0 self-start rounded text-sm text-fg-muted underline underline-offset-2 hover:text-fg transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    Yasal uyarı ve çekince
                </Link>
            </div>
        </PageContainer>
    );
}
