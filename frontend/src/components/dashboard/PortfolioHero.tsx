'use client';

import type { ReactNode } from 'react';
import Hero, { HeroMeta } from '@/components/ui/Hero';
import ChangePill from '@/components/ui/ChangePill';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import type { Currency } from '@/hooks/useCurrency';
import type { DashboardTotals } from './SummaryCards';

// Günlük değişim (TL tutar + yüzde); varlıkların günlük getirisi yoksa null
export interface DayChange {
    amount: number;
    pct: number;
}

interface PortfolioHeroProps {
    totals: DashboardTotals;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    currency: Currency;          // ekranda gösterilen para birimi
    usdRate: number | null;      // kur alınamadıysa null
    onToggleCurrency: () => void;
    dayChange?: DayChange | null;
    children?: ReactNode;        // altta tam genişlik portföy grafiği
}

// Sayfanın odak noktası: büyük toplam değer, altında bugünkü ve toplam getiri, sağda para birimi seçici
export default function PortfolioHero({ totals, fmt, currency, usdRate, onToggleCurrency, dayChange, children }: PortfolioHeroProps) {
    const { totalVal, totalCombinedProfit, totalReturnPct } = totals;

    return (
        <Hero
            label="Portföyünüz bugün"
            value={fmt(totalVal)}
            sub={
                <>
                    {dayChange && (
                        <HeroMeta label="Bugün">
                            <ChangePill value={dayChange.pct} amount={fmt(dayChange.amount, true)} size="md" />
                        </HeroMeta>
                    )}
                    <HeroMeta label="Toplam getiri">
                        <ChangePill value={totalReturnPct} amount={fmt(totalCombinedProfit, true)} size="md" />
                    </HeroMeta>
                </>
            }
            aside={<CurrencyToggle currency={currency} onToggle={onToggleCurrency} disabled={usdRate === null} />}
        >
            {children}
        </Hero>
    );
}
