'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ASSET_TYPE_LABELS, formatPriceTR } from '@/lib/formatters';
import { PERIOD_LABELS } from '@/lib/periodUtils';
import Hero, { HeroMeta } from '@/components/ui/Hero';
import SummaryStrip from '@/components/ui/SummaryStrip';
import ChangePill from '@/components/ui/ChangePill';
import { AssetDetailInfo, AssetFundamentals, formatIndexPoints, isIndexAsset } from './types';

interface AssetHeaderCardProps {
    assetData: AssetDetailInfo;
    rawSymbol: string;
    fundamentals: AssetFundamentals | null;
    summaryData: Record<string, number> | null;
    periodReturn: number | null;
    onRefreshStale: () => void;
    actions?: ReactNode;  // sağdaki düğmeler (alarm, işlem ekle vb.)
    children?: ReactNode; // fiyat grafiği; fiyatın hemen altında tam genişlikte durur
}

// Günlük değişim için önce özet verisindeki 1G getirisine, sonra varlığın change alanına bakılır.
// change boş ya da sıfırsa grafikte seçili dönemin getirisi kullanılır; o da yoksa change olduğu gibi okunur.
function resolveDailyChange(
    summaryData: Record<string, number> | null,
    assetData: AssetDetailInfo,
    periodReturn: number | null
): number | null {
    if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D'])) {
        return summaryData['1D'];
    }
    const change = assetData.change;
    const hasNonZeroChange = change !== undefined && change !== '' && change !== '0.00' && change !== '0';
    if (!hasNonZeroChange && periodReturn !== null && !isNaN(periodReturn)) {
        return periodReturn;
    }
    if (change === undefined) return null;
    const parsed = parseFloat(String(change).replace('+', ''));
    return isNaN(parsed) ? null : parsed;
}

// Grafiğin altındaki dönem getirisi şeridi (1G zaten fiyatın altındaki satırda)
const STRIP_PERIODS = ['1W', '1M', '3M', '6M', 'YTD', '1Y'];

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Sayfanın odak noktası: geri bağlantısı ve sembol satırı, büyük fiyat, grafik ve dönem getirileri
export default function AssetHeaderCard({
    assetData,
    rawSymbol,
    fundamentals,
    summaryData,
    periodReturn,
    onRefreshStale,
    actions,
    children,
}: AssetHeaderCardProps) {
    const isFund = assetData.asset_type === 'FON';
    const isGold = assetData.asset_type === 'ALTIN';
    const isIndex = isIndexAsset(rawSymbol, assetData.asset_type);
    const price = parseFloat(assetData.current_price ?? '');
    const dailyChange = resolveDailyChange(summaryData, assetData, periodReturn);
    const symbol = assetData.symbol || rawSymbol;
    const typeLabel = ASSET_TYPE_LABELS[assetData.asset_type ?? ''] ?? assetData.asset_type;
    // Tür adı varlığın adında zaten geçiyorsa ("Gram Altın" / Altın) tekrar yazılmaz
    const showTypeLabel = !!typeLabel && !(assetData.name ?? '').toLocaleLowerCase('tr').includes(typeLabel.toLocaleLowerCase('tr'));
    // Yalnızca API'den gelen geçerli getiriler gösterilir
    const periodReturns = STRIP_PERIODS
        .map(id => ({ id, value: summaryData?.[id] }))
        .filter((p): p is { id: string; value: number } => typeof p.value === 'number' && isFinite(p.value));

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                {/* Geri bağlantısı ve varlığın kimliği */}
                <div className="flex flex-col gap-2 min-w-0">
                    <Link
                        href="/"
                        className={cn(
                            'inline-flex items-center gap-1.5 w-fit min-h-11 sm:min-h-10 -my-1.5 rounded text-sm text-fg-muted',
                            'transition-colors duration-[120ms] hover:text-fg',
                            focusRing,
                        )}
                    >
                        <ArrowLeft className="size-4" aria-hidden />
                        Ana sayfa
                    </Link>
                    <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                        <span className="font-mono text-xl font-semibold text-fg break-all">{symbol}</span>
                        <span className="text-base text-fg min-w-0 truncate">{assetData.name || 'Yükleniyor...'}</span>
                        {showTypeLabel && <span className="text-sm text-fg-muted">{typeLabel}</span>}
                    </h1>
                </div>

                <Hero
                    value={isNaN(price) ? '—' : isIndex ? formatIndexPoints(price) : formatPriceTR(price)}
                    sub={
                        <>
                            {dailyChange !== null && (
                                <HeroMeta label="Günlük">
                                    <ChangePill value={dailyChange} size="md" />
                                </HeroMeta>
                            )}
                            {/* Fon fiyatları gün içinde değişmez, TEFAS'ta günlük yayımlanır */}
                            <Link
                                href="/disclaimer"
                                title={
                                    isFund
                                        ? "Fon fiyatları TEFAS'ta yayımlanan günlük fiyatlardır. Yatırım tavsiyesi değildir."
                                        : isGold
                                            ? 'Gram altın fiyatı serbest piyasa satış fiyatıdır, gösterge niteliğindedir. Yatırım tavsiyesi değildir.'
                                            : 'BIST verileri en az 15 dakika gecikmelidir. Yatırım tavsiyesi değildir.'
                                }
                                className={cn(
                                    // Dikey iç boşluk tıklama alanını 44/40px'e çıkarır, satır yüksekliğini değiştirmez
                                    'inline-block py-3 -my-3 sm:py-2.5 sm:-my-2.5 rounded font-sans text-sm text-fg-muted whitespace-nowrap',
                                    'underline decoration-border-strong underline-offset-4 transition-colors duration-[120ms] hover:text-fg',
                                    focusRing,
                                )}
                            >
                                {isFund ? 'Günlük fiyat (TEFAS)' : isGold ? 'Serbest piyasa fiyatı' : '15 dk gecikmeli'}
                            </Link>
                            {fundamentals?.staleMessage && (
                                <button
                                    type="button"
                                    onClick={onRefreshStale}
                                    title="Verileri yenilemek için tıklayın"
                                    className={cn(
                                        'min-w-0 py-3 -my-3 sm:py-2.5 sm:-my-2.5 rounded font-sans text-sm text-left cursor-pointer transition-colors duration-[120ms]',
                                        focusRing,
                                        // Eski veri amber, taze veri soluk yazılır
                                        fundamentals.isStale ? 'text-warning hover:text-fg' : 'text-fg-muted hover:text-fg',
                                    )}
                                >
                                    {fundamentals.staleMessage}
                                </button>
                            )}
                        </>
                    }
                    aside={actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                >
                    {children}
                </Hero>
            </div>

            {periodReturns.length > 0 && (
                <SummaryStrip
                    ariaLabel="Dönem getirileri"
                    items={periodReturns.map(p => ({
                        label: <span className="font-mono">{PERIOD_LABELS[p.id] ?? p.id}</span>,
                        value: <ChangePill value={p.value} size="md" />,
                    }))}
                />
            )}
        </div>
    );
}
