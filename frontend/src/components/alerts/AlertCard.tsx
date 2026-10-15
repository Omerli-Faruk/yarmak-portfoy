'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { formatDate, formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import { cn } from '@/lib/cn';
import { tableHeadRowClasses } from '@/components/ui/tableStyles';
import type { NormalizedAlert } from '@/types';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

interface AlertCardProps {
    alert: NormalizedAlert;
    onDelete: (id: number) => void;
}

// Masaüstü tablo sütun genişlikleri; başlık satırı ve alarm satırları aynısını kullanır.
// Tetiklenme zamanı yalnızca xl ve üstünde durum sütununda görünür, lg'de sütun dar kalır.
const COL = {
    direction: 'w-40 shrink-0',
    target: 'w-28 shrink-0 text-right',
    last: 'w-28 shrink-0 text-right',
    distance: 'w-32 shrink-0 text-right',
    status: 'w-28 xl:w-56 shrink-0',
    action: 'w-20 shrink-0',
} as const;

// Son fiyatın hedefe yüzde uzaklığı. Fiyat bilinmiyorsa pct null döner.
function getDistance(alert: NormalizedAlert): { pct: number | null; isReached: boolean } {
    const { currentPrice, targetPrice } = alert;
    if (currentPrice <= 0) return { pct: null, isReached: false };

    if (alert.direction === 'ABOVE') {
        if (targetPrice <= currentPrice) return { pct: null, isReached: true };
        return { pct: ((targetPrice - currentPrice) / currentPrice) * 100, isReached: false };
    }

    if (targetPrice >= currentPrice) return { pct: null, isReached: true };
    return { pct: -((currentPrice - targetPrice) / currentPrice) * 100, isReached: false };
}

function DistanceText({ alert }: { alert: NormalizedAlert }) {
    const { pct, isReached } = getDistance(alert);
    if (isReached) return <span className="text-profit">Hedefe ulaşıldı</span>;
    if (pct === null) return <span className="font-mono text-fg-subtle">—</span>;
    return (
        <span className="whitespace-nowrap">
            <span className="font-mono text-fg">{formatSignedPercent(pct)}</span>{' '}
            <span className="text-fg-muted">kaldı</span>
        </span>
    );
}

// Yön: renkli ▲/▼ ve kısa metin, zemin yok
function DirectionText({ isAbove, className }: { isAbove: boolean; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', isAbove ? 'text-profit' : 'text-loss', className)}>
            <span aria-hidden className="text-[0.8em] leading-none">{isAbove ? '▲' : '▼'}</span>
            {isAbove ? 'Fiyat yükselirse' : 'Fiyat düşerse'}
        </span>
    );
}

// Durum rozet yerine düz yazı: her satırda rozet olunca tablo kalabalıklaşıyordu
function StatusText({ alert }: { alert: NormalizedAlert }) {
    return alert.isTriggered ? (
        <span className="text-profit whitespace-nowrap">Hedefe ulaştı</span>
    ) : (
        <span className="text-fg-muted whitespace-nowrap">Bekliyor</span>
    );
}

// Görünen yazı satır içinde kalır; dokunma alanı after ile üstten/alttan genişletilir (en az 44px)
function SymbolLink({ symbol }: { symbol: string }) {
    return (
        <Link
            href={`/varlik/${encodeURIComponent(symbol)}`}
            className="relative shrink-0 rounded font-mono text-sm font-medium text-fg after:absolute after:-inset-x-1 after:-inset-y-3 hover:text-primary transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            {symbol}
        </Link>
    );
}

function Price({ value, className }: { value: number; className?: string }) {
    return (
        <span className={cn('font-mono whitespace-nowrap', className ?? 'text-fg')}>
            {value > 0 ? formatPriceTR(value) : '— ₺'}
        </span>
    );
}

// Masaüstü tablonun başlık satırı (lg ve üstü): hafif zeminli bant (tableStyles)
export function AlertTableHeader() {
    return (
        <div className={tableHeadRowClasses('sticky top-0 z-10 hidden lg:flex gap-4 xl:gap-6')}>
            <span className="flex-1 min-w-0">Varlık</span>
            <span className={COL.direction}>Koşul</span>
            <span className={COL.target}>Hedef fiyat</span>
            <span className={COL.last}>Son fiyat</span>
            <span className={COL.distance}>Hedefe mesafe</span>
            <span className={COL.status}>Durum</span>
            <span className={COL.action} aria-hidden />
        </div>
    );
}

// Alarm satırı: lg ve üstünde 48px tablo satırı, altında iki satırlı yığın (solda sembol/ad, sağda hedef/durum).
// Satır, başlık bandıyla aynı px-3 iç boşluğu kullanır; sütunlar hizalı kalır.
export default function AlertCard({ alert, onDelete }: AlertCardProps) {
    const isAbove = alert.direction === 'ABOVE';
    const triggeredAt = alert.isTriggered && alert.triggeredAt ? formatDate(alert.triggeredAt) : null;
    const handleDelete = () => onDelete(alert.id);

    return (
        <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
            {/* Masaüstü: tablo satırı */}
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 h-12 px-3 rounded text-sm hover:bg-surface-2 transition-colors duration-[120ms]">
                <div className="flex flex-1 min-w-0 items-baseline gap-2">
                    <SymbolLink symbol={alert.symbol} />
                    <span className="truncate text-xs text-fg-muted">{alert.assetName}</span>
                </div>
                <span className={COL.direction}>
                    <DirectionText isAbove={isAbove} />
                </span>
                <span className={COL.target}>
                    <span className="font-mono font-medium text-fg whitespace-nowrap">{formatPriceTR(alert.targetPrice)}</span>
                </span>
                <span className={COL.last}>
                    <Price value={alert.currentPrice} />
                </span>
                <span className={COL.distance}>
                    {alert.isTriggered ? <span className="text-fg-muted">—</span> : <DistanceText alert={alert} />}
                </span>
                <span className={cn(COL.status, 'flex items-baseline gap-2 min-w-0')}>
                    <StatusText alert={alert} />
                    {triggeredAt && (
                        <span className="hidden xl:inline truncate font-mono text-xs text-fg-muted">{triggeredAt}</span>
                    )}
                </span>
                <span className={cn(COL.action, 'flex justify-end')}>
                    {/* Masaüstünde yer var: simge yerine yazılı düğme */}
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 aria-hidden />}
                        onClick={handleDelete}
                        aria-label="Alarmı sil"
                        className="-mr-2 hover:text-loss"
                    >
                        Sil
                    </Button>
                </span>
            </div>

            {/* Mobil ve tablet: iki satırlı yığın satır */}
            <div className="flex lg:hidden items-center gap-2 -mx-2 px-2 py-3 rounded hover:bg-surface-2 transition-colors duration-[120ms]">
                <div className="flex flex-1 min-w-0 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                            <SymbolLink symbol={alert.symbol} />
                            <DirectionText isAbove={isAbove} className="text-xs" />
                        </div>
                        <span className="shrink-0 font-mono text-sm font-medium text-fg whitespace-nowrap">
                            {formatPriceTR(alert.targetPrice)}
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 min-w-0 text-xs">
                        <span className="flex-1 min-w-0 truncate text-fg-muted">{alert.assetName}</span>
                        <span className="flex max-w-[70%] flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
                            <span className="inline-flex items-baseline gap-1">
                                <span className="text-fg-muted">Son fiyat</span>
                                <Price value={alert.currentPrice} />
                            </span>
                            {alert.isTriggered ? (
                                <>
                                    <StatusText alert={alert} />
                                    {triggeredAt && <span className="font-mono text-fg-muted">{triggeredAt}</span>}
                                </>
                            ) : (
                                <DistanceText alert={alert} />
                            )}
                        </span>
                    </div>
                </div>
                <div className="-mr-1.5 shrink-0">
                    <IconButton
                        icon={<Trash2 />}
                        label="Alarmı sil"
                        size="sm"
                        onClick={handleDelete}
                        className="hover:text-loss"
                    />
                </div>
            </div>
        </motion.li>
    );
}
