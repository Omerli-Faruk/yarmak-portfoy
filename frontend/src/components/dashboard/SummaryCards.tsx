'use client';

import { useMemo, type ReactNode } from 'react';
import type { Dividend, UserHolding } from '@/types';
import SummaryStrip, { type SummaryStripItem } from '@/components/ui/SummaryStrip';
import Section from '@/components/ui/Section';
import ChangePill from '@/components/ui/ChangePill';
import { normalizeDividend } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateOnly, formatPercent, formatSignedPercent, formatTRY } from '@/lib/formatters';
import type { Currency } from '@/hooks/useCurrency';

// Sayfada bir kez hesaplanan toplamlar (TL)
export interface DashboardTotals {
    totalVal: number;            // açık pozisyonlar + nakit temettü
    equityVal: number;           // açık pozisyonlar
    totalDividends: number;
    totalCost: number;
    realizedPnL: number;
    capitalPnl: number;          // açık pozisyonların K/Z'si
    totalCombinedProfit: number; // sermaye K/Z + temettü + gerçekleşen K/Z
    totalReturnPct: number;
    totalCommission: number;
}

type Fmt = (amountTRY: number, showPlusSign?: boolean) => string;

// Varlık türlerine göre adetler
function useTypeCounts(holdings: UserHolding[]) {
    return useMemo(() => {
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
        const typeCounts = [
            { label: 'Hisse', value: hisse },
            { label: 'Fon', value: fon },
            { label: 'Altın', value: altin },
            { label: 'Döviz', value: doviz },
        ].filter(t => t.value > 0);
        return { typeCounts, total: holdings.length };
    }, [holdings]);
}

// Temettülerden kesilen stopaj ve toplam komisyon
function useTaxInfo(dividends: Dividend[], totalCommission: number) {
    return useMemo(() => {
        let totalDividendTax = 0;
        if (dividends && Array.isArray(dividends)) {
            dividends.forEach(d => {
                totalDividendTax += normalizeDividend(d).tax;
            });
        }
        return {
            totalTax: totalDividendTax,
            totalDeductions: totalDividendTax + totalCommission,
        };
    }, [dividends, totalCommission]);
}

interface SummaryCardsProps {
    holdings: UserHolding[];
    dividends: Dividend[];
    totals: DashboardTotals;
    fmt: Fmt;
}

// Kahramanın altındaki tek özet şeridi: ikincil rakamlar ince çizgilerle ayrılmış hücrelerde.
// Toplam değer Hero'da; getiri kaynakları, stopaj/komisyon ayrımı ve kur Detaylar'da.
export default function SummaryCards({ holdings, dividends, totals, fmt }: SummaryCardsProps) {
    const { totalDividends, totalCost, realizedPnL, totalCommission } = totals;
    const { typeCounts, total } = useTypeCounts(holdings);
    const taxInfo = useTaxInfo(dividends, totalCommission);

    const typeHint = typeCounts.length > 0
        ? typeCounts.map(t => `${t.label} ${t.value}`).join(' · ')
        : undefined;

    const items: SummaryStripItem[] = [
        { label: 'Maliyet', value: fmt(totalCost) },
        {
            label: 'Nakit temettü',
            value: totalDividends > 0 ? `+${fmt(totalDividends)}` : fmt(totalDividends),
            tone: totalDividends > 0 ? 'profit' : 'default',
        },
        { label: 'Varlık sayısı', value: total, hint: typeHint, title: typeHint },
    ];
    if (realizedPnL !== 0) {
        items.push({ label: 'Satış K/Z', value: fmt(realizedPnL, true), tone: realizedPnL >= 0 ? 'profit' : 'loss' });
    }
    items.push({ label: 'Vergi ve komisyon', value: fmt(taxInfo.totalDeductions) });

    return <SummaryStrip items={items} ariaLabel="Portföy özeti" />;
}

interface DashboardDetailsProps {
    holdings: UserHolding[];
    dividends: Dividend[];
    totals: DashboardTotals;
    fmt: Fmt;
    currency: Currency;      // gösterilen para birimi; toplamın karşılığı diğer birimde yazılır
    usdRate: number | null;  // kur alınamadıysa null
}

// Pozisyonlardan türetilen göstergeler: kârda/zararda sayısı, en iyi/kötü, yoğunlaşma ve ilk alım
function usePositionStats(holdings: UserHolding[], equityVal: number) {
    return useMemo(() => {
        const rows = holdings
            .filter(h => h.total_value > 0)
            .map(h => {
                const cost = h.average_cost * h.total_amount;
                return {
                    symbol: h.symbol,
                    pct: cost > 0 ? (h.profit_loss / cost) * 100 : 0,
                    weight: equityVal > 0 ? (h.total_value / equityVal) * 100 : 0,
                    pnl: h.profit_loss,
                    firstBuy: h.first_buy_date ? new Date(h.first_buy_date) : null,
                };
            });
        if (rows.length === 0) return null;

        const byPct = [...rows].sort((a, b) => b.pct - a.pct);
        const byWeight = [...rows].sort((a, b) => b.weight - a.weight);
        const firstBuy = rows
            .map(r => r.firstBuy)
            .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

        return {
            count: rows.length,
            winners: rows.filter(r => r.pnl > 0).length,
            losers: rows.filter(r => r.pnl < 0).length,
            best: byPct[0],
            worst: byPct.length > 1 ? byPct[byPct.length - 1] : null,
            largest: byWeight[0],
            top3Share: byWeight.slice(0, 3).reduce((sum, r) => sum + r.weight, 0),
            firstBuy,
        };
    }, [holdings, equityVal]);
}

// Geçen süre: "1 yıl 3 ay", "5 ay", "12 gün"
function formatAge(from: Date): string {
    const now = new Date();
    let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
    if (now.getDate() < from.getDate()) months--;
    if (months < 1) {
        const days = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86400000));
        return `${days} gün`;
    }
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years > 0 ? `${years} yıl` : '', rest > 0 ? `${rest} ay` : ''].filter(Boolean).join(' ');
}

// Panonun altındaki ayrıntılar, üç grup: toplam getirinin kaynağı, pozisyon istatistikleri, kesintiler ve kur.
// Şeritteki toplamları farklı açıdan (pay, oran, dağılım) gösterir.
export function DashboardDetails({ holdings, dividends, totals, fmt, currency, usdRate }: DashboardDetailsProps) {
    const { totalCommission, totalCost, totalDividends, realizedPnL, capitalPnl, totalCombinedProfit, totalVal, equityVal } = totals;
    const taxInfo = useTaxInfo(dividends, totalCommission);
    const stats = usePositionStats(holdings, equityVal);

    // Toplam getirinin kaynakları; pay kalemlerin mutlak toplamına göre (eksi kalem olsa da toplam %100)
    const sources = [
        { label: 'Açık pozisyonlar', value: capitalPnl, color: 'bg-primary' },
        { label: 'Satışlar', value: realizedPnL, color: 'bg-primary/45' },
        { label: 'Temettü', value: totalDividends, color: 'bg-warning' },
    ];
    const absTotal = sources.reduce((sum, src) => sum + Math.abs(src.value), 0);
    const capitalPct = totalCost > 0 ? (capitalPnl / totalCost) * 100 : 0;
    const otherCurrency: Currency = currency === 'USD' ? 'TRY' : 'USD';

    return (
        <Section title="Detaylar">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
                <DetailGroup title="Getirinin kaynağı">
                    {absTotal > 0 && (
                        <div className="flex h-2 w-full gap-px overflow-hidden rounded-sm" aria-hidden>
                            {sources.filter(src => src.value !== 0).map(src => (
                                <div
                                    key={src.label}
                                    className={src.color}
                                    style={{ flexGrow: Math.abs(src.value), flexBasis: 0 }}
                                />
                            ))}
                        </div>
                    )}
                    <dl className="flex flex-col divide-y divide-border">
                        {sources.map(src => (
                            <Fact
                                key={src.label}
                                label={
                                    <span className="flex items-center gap-2">
                                        <span className={cn('size-2.5 shrink-0 rounded-[2px]', src.color)} aria-hidden />
                                        {src.label}
                                    </span>
                                }
                                hint={absTotal > 0 ? `Pay ${formatPercent((Math.abs(src.value) / absTotal) * 100)}` : undefined}
                            >
                                <span className={src.value > 0 ? 'text-profit' : src.value < 0 ? 'text-loss' : 'text-fg'}>
                                    {fmt(src.value, true)}
                                </span>
                            </Fact>
                        ))}
                        <Fact
                            label="Toplam getiri"
                            hint={totalCost > 0 ? `Açık pozisyonlar ${formatSignedPercent(capitalPct)}` : undefined}
                        >
                            <span className={cn('font-medium', totalCombinedProfit >= 0 ? 'text-profit' : 'text-loss')}>
                                {fmt(totalCombinedProfit, true)}
                            </span>
                        </Fact>
                    </dl>
                </DetailGroup>

                <DetailGroup title="Pozisyonlar">
                    {stats ? (
                        <dl className="flex flex-col divide-y divide-border">
                            <Fact label="Kârda / zararda" hint={`${stats.count} pozisyon`}>
                                <span className="text-profit">{stats.winners}</span>
                                <span className="text-fg-muted"> / </span>
                                <span className="text-loss">{stats.losers}</span>
                            </Fact>
                            <Fact label="En iyi performans" hint={stats.best.symbol}>
                                <ChangePill value={stats.best.pct} />
                            </Fact>
                            {stats.worst && (
                                <Fact label="En kötü performans" hint={stats.worst.symbol}>
                                    <ChangePill value={stats.worst.pct} />
                                </Fact>
                            )}
                            <Fact label="En büyük pozisyon" hint={stats.largest.symbol}>
                                {formatPercent(stats.largest.weight)}
                            </Fact>
                            {stats.count > 3 && (
                                <Fact label="İlk 3 pozisyonun payı">{formatPercent(stats.top3Share)}</Fact>
                            )}
                            {stats.firstBuy && (
                                <Fact label="İlk alım" hint={`${formatAge(stats.firstBuy)} önce`}>
                                    {formatDateOnly(stats.firstBuy)}
                                </Fact>
                            )}
                        </dl>
                    ) : (
                        <p className="text-sm text-fg-muted">Açık pozisyon yok.</p>
                    )}
                </DetailGroup>

                <DetailGroup title="Kesintiler ve kur">
                    <dl className="flex flex-col divide-y divide-border">
                        <Fact label="Temettü stopajı">{fmt(taxInfo.totalTax)}</Fact>
                        <Fact label="İşlem komisyonu">{fmt(totalCommission)}</Fact>
                        {totalCost > 0 && taxInfo.totalDeductions > 0 && (
                            <Fact label="Kesintilerin maliyete oranı">
                                {formatPercent((taxInfo.totalDeductions / totalCost) * 100, 2)}
                            </Fact>
                        )}
                        {usdRate !== null && (
                            <>
                                <Fact label="Kullanılan kur">{`1 $ = ${formatTRY(usdRate)}`}</Fact>
                                <Fact label={otherCurrency === 'USD' ? 'Dolar karşılığı' : 'TL karşılığı'}>
                                    {formatCurrency(totalVal, otherCurrency, usdRate)}
                                </Fact>
                            </>
                        )}
                    </dl>
                </DetailGroup>
            </div>
        </Section>
    );
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 min-w-0 lg:basis-0 lg:grow">
            <h3 className="pb-2 border-b border-border text-base font-semibold text-fg">{title}</h3>
            {children}
        </div>
    );
}

// Etiket/değer satırı; hint değerin altında küçük yazı (sembol, pay, tarih gibi)
function Fact({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 min-h-11 py-1.5 text-sm">
            <dt className="min-w-0 text-fg-muted">{label}</dt>
            <dd className="flex min-w-0 flex-col items-end text-right">
                <span className="max-w-full truncate font-mono text-fg">{children}</span>
                {hint && <span className="font-mono text-xs text-fg-muted">{hint}</span>}
            </dd>
        </div>
    );
}
