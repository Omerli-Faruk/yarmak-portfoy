'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { InteractiveAreaChart } from '@/components/InteractiveAreaChart';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import SummaryCards, { type DashboardTotals } from '@/components/dashboard/SummaryCards';
import AllocationDonutCard from '@/components/dashboard/AllocationDonutCard';
import CategoryPnlCard from '@/components/dashboard/CategoryPnlCard';
import { buildPortfolioChartData } from '@/components/dashboard/portfolioChartData';
import { formatCurrency } from '@/lib/formatters';
import { CHART_PERIODS } from '@/lib/periodUtils';
import { useCurrency, type Currency } from '@/hooks/useCurrency';
import { usePortfolioData } from '@/hooks/usePortfolioData';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const { summary, holdings, history, dividends, assetSummaries, usdRate, loading, refreshing, loadError, reload } =
        usePortfolioData(user, { withHistory: true, withDividends: true });

    const { currency, toggleCurrency } = useCurrency();
    // Kur alınamadıysa USD seçili olsa bile tutarlar TL gösterilir
    const displayCurrency: Currency = usdRate !== null ? currency : 'TRY';
    const usdDivisor = displayCurrency === 'USD' ? usdRate : null;

    // Grafik periyodu: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, ALL
    const [chartPeriod, setChartPeriod] = useState<string>('1M');

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

    const userCreatedAt = user?.created_at;
    const chartData = useMemo(
        () => summary
            ? buildPortfolioChartData({
                summary,
                history,
                holdings,
                assetSummaries,
                userCreatedAt,
                period: chartPeriod,
                currentVal: totalVal,
                usdDivisor,
            })
            : [],
        [summary, history, holdings, assetSummaries, userCreatedAt, chartPeriod, totalVal, usdDivisor]
    );

    // Grafik değerleri gösterilen para biriminde; fmt TL beklediği için USD'de kurla geri çevrilir
    const chartValueFormatter = useCallback(
        (val: number) => fmt(usdDivisor ? val * usdDivisor : val),
        [fmt, usdDivisor]
    );

    if (authLoading || loading) {
        return <LoadingSpinner withLogo message="Portföy verileri yükleniyor..." />;
    }

    // Özet ya da varlık listesi gelmediyse kartlar sıfır veya eksik görünür; kullanıcıyı uyar.
    // Özet açık pozisyon sayısını veriyor, liste boş geldiyse varlık verisi eksik demektir.
    const showLoadError = loadError || !summary || (summary.holdings_count > 0 && holdings.length === 0);

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                <DashboardHeader
                    username={user?.username}
                    currency={currency}
                    currencyDisabled={usdRate === null}
                    onToggleCurrency={toggleCurrency}
                    refreshing={refreshing}
                    onRefresh={() => void reload(true)}
                />

                {showLoadError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Portföy verileri sunucudan alınamadı, gösterilen tutarlar eksik ya da güncel olmayabilir. Üstteki yenile düğmesiyle tekrar deneyebilirsiniz.</span>
                    </div>
                )}

                {/* Özet kartlar */}
                <SummaryCards
                    holdings={holdings}
                    dividends={dividends}
                    totals={totals}
                    fmt={fmt}
                    currency={displayCurrency}
                    usdRate={usdRate}
                />

                {/* Portföy değer grafiği */}
                <InteractiveAreaChart
                    title="Portföy Değer Gelişimi"
                    subtitle={chartPeriod === '1D'
                        ? 'Gün içi grafik, önceki kapanış ile güncel değer arasında tahmini çizilir.'
                        : 'Seçilen periyotta portföyünüzün büyüme grafiği ve dönemsel performansı'}
                    data={chartData}
                    dataKey="value"
                    dateKey="date"
                    periods={CHART_PERIODS}
                    activePeriod={chartPeriod}
                    onPeriodChange={setChartPeriod}
                    currencySymbol={displayCurrency === 'USD' ? '$' : '₺'}
                    currency={displayCurrency}
                    valueFormatter={chartValueFormatter}
                    showBrush={true}
                    showStats={true}
                    isLoading={refreshing}
                />

                {/* Varlık sınıfı dağılımı ve kategori K/Z */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AllocationDonutCard breakdown={summary?.breakdown} fmt={fmt} />
                    <CategoryPnlCard breakdown={summary?.breakdown} fmt={fmt} usdDivisor={usdDivisor} />
                </div>

                {/* Varlıklarım sayfasına geçiş */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Varlıklarınızı Gruplayın ve Sıralayın</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                            Varlıklarınızı özel gruplara (Temettü, Büyüme, Teknoloji vb.) ayırabilir, grup bazında kâr/zararınızı izleyebilir ve günlük, haftalık, aylık (1G, 1H, 1A) getirilere göre sıralayabilirsiniz. Gruplar yalnızca bu tarayıcıda saklanır.
                        </p>
                    </div>
                    <Link
                        href="/holdings"
                        className="px-6 py-3 rounded-xl bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold text-xs transition shadow-sm shadow-[#1A9FD3]/20 shrink-0"
                    >
                        Varlıklarımı Yönet & Grupla →
                    </Link>
                </div>

                {/* Veri kaynağı ve yasal uyarı */}
                <div className="pt-2 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-slate-800/60 font-mono">
                    <p>
                        * BIST fiyatları en az 15 dakika gecikmelidir; fon fiyatları TEFAS&apos;ta yayımlanan günlük fiyatlardır, altın ve döviz kurları gösterge niteliğindedir. Bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
                    </p>
                    <Link href="/disclaimer" className="text-slate-400 hover:text-slate-200 underline transition shrink-0">
                        Yasal Uyarı &amp; Çekince
                    </Link>
                </div>
            </div>
        </div>
    );
}
