import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import { formatDate, formatPriceTR } from '@/lib/formatters';
import type { NormalizedAlert } from '@/types';

interface NotificationItemProps {
    alert: NormalizedAlert;
    wasSeen: boolean;
    onClick: () => void;
}

// Bildirim panelindeki tek bir tetiklenmiş alarm satırı
export default function NotificationItem({ alert, wasSeen, onClick }: NotificationItemProps) {
    const isAbove = alert.direction === 'ABOVE';

    return (
        <div
            onClick={onClick}
            className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer flex items-start gap-3 group ${
                !wasSeen ? 'bg-slate-800/20' : ''
            }`}
        >
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-slate-600 transition">
                {isAbove ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                    <ArrowDownRight className="w-4 h-4 text-rose-400" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono group-hover:text-primary transition">
                            {alert.symbol}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 rounded ${
                            isAbove
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                        }`}>
                            {isAbove ? 'Hedefe Yükseldi' : 'Hedefe Düştü'}
                        </span>
                    </div>
                    {!wasSeen && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Yeni Bildirim" />
                    )}
                </div>

                <p className="text-[11px] text-slate-300 leading-snug">
                    Fiyat, hedeflediğiniz <strong className="text-white font-mono">{formatPriceTR(alert.targetPrice)}</strong> seviyesine ulaştı.
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/40">
                    <span>Son fiyat: <strong className="text-slate-200">{alert.currentPrice > 0 ? formatPriceTR(alert.currentPrice) : '—'}</strong></span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatDate(alert.triggeredAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}
