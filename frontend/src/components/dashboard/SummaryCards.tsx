'use client';

import { useMemo, type ReactNode } from 'react';
import type { Dividend, UserHolding } from '@/types';
import SummaryStrip, { type SummaryStripItem } from '@/components/ui/SummaryStrip';
import Disclosure from '@/components/ui/Disclosure';
import { normalizeDividend } from '@/lib/normalize';
import { formatTRY } from '@/lib/formatters';

// Sayfada bir kez hesaplanan toplamlar (TL)
export interface DashboardTotals {
    totalVal: number;            // açık pozisyonlar + nakit temettü
    equityVal: number;           // açık pozisyonlar
    totalDividends: number;
    totalCost: number;
    realizedPnL: number;
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
// Toplam değer Hero'da, stopaj/komisyon ayrımı ve kur Detaylar'da; burada tekrar edilmez.
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
    dividends: Dividend[];
    totals: DashboardTotals;
    fmt: Fmt;
    usdRate: number | null; // kur alınamadıysa null
}

// Seyrek gereken rakamlar: varsayılan kapalı "Detaylar" bölümünde etiket/değer satırları.
// Şeritteki "Vergi ve komisyon" toplamının ayrımı ve kullanılan kur burada.
export function DashboardDetails({ dividends, totals, fmt, usdRate }: DashboardDetailsProps) {
    const { totalCommission } = totals;
    const taxInfo = useTaxInfo(dividends, totalCommission);

    return (
        <Disclosure summary="Detaylar">
            <dl className="flex flex-col max-w-md border-t border-border divide-y divide-border">
                <Fact label="Stopaj">{fmt(taxInfo.totalTax)}</Fact>
                <Fact label="Komisyon">{fmt(totalCommission)}</Fact>
                {usdRate !== null && <Fact label="Kullanılan kur">{`1 $ = ${formatTRY(usdRate)}`}</Fact>}
            </dl>
        </Disclosure>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 min-h-11 py-2 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="font-mono text-fg truncate">{children}</dd>
        </div>
    );
}
