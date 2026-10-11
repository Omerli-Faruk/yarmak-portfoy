import { formatDate, formatPriceTR } from '@/lib/formatters';
import type { NormalizedAlert } from '@/types';
import { cn } from '@/lib/cn';

interface NotificationItemProps {
    alert: NormalizedAlert;
    wasSeen: boolean;
    onClick: () => void;
}

// Bildirim panelindeki tek bir tetiklenmiş alarm satırı
export default function NotificationItem({ alert, wasSeen, onClick }: NotificationItemProps) {
    const isAbove = alert.direction === 'ABOVE';

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group relative flex flex-col gap-1 w-full px-4 py-3 text-left cursor-pointer transition-colors duration-[120ms]',
                'hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2',
            )}
        >
            {/* Görülmemiş bildirimin solunda ince mavi çizgi */}
            {!wasSeen && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}

            <span className="flex items-center justify-between gap-2">
                <span className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-sm font-medium text-fg group-hover:text-primary transition-colors duration-[120ms]">
                        {alert.symbol}
                    </span>
                    <span className={cn('flex items-center gap-1 text-sm', isAbove ? 'text-profit' : 'text-loss')}>
                        <span aria-hidden className="text-[0.8em]">{isAbove ? '▲' : '▼'}</span>
                        {isAbove ? 'Hedefe yükseldi' : 'Hedefe düştü'}
                    </span>
                </span>
                {!wasSeen && <span className="sr-only">Yeni bildirim</span>}
                <span className="font-mono text-xs text-fg-muted whitespace-nowrap">{formatDate(alert.triggeredAt)}</span>
            </span>

            <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-fg-muted">
                <span>
                    Hedef <span className="font-mono font-medium text-fg">{formatPriceTR(alert.targetPrice)}</span>
                </span>
                <span>
                    Son fiyat <span className="font-mono text-fg">{alert.currentPrice > 0 ? formatPriceTR(alert.currentPrice) : '—'}</span>
                </span>
            </span>
        </button>
    );
}
