'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { formatDate, formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import type { NormalizedAlert } from '@/types';

interface AlertCardProps {
    alert: NormalizedAlert;
    onDelete: (id: number) => void;
}

// Son fiyatın hedefe yüzde uzaklığı. Fiyat bilinmiyorsa "—" döner.
function getDistance(alert: NormalizedAlert): { text: string; isReached: boolean } {
    const { currentPrice, targetPrice } = alert;
    if (currentPrice <= 0) return { text: '—', isReached: false };

    if (alert.direction === 'ABOVE') {
        if (targetPrice <= currentPrice) return { text: 'Hedefe ulaşıldı', isReached: true };
        const diff = ((targetPrice - currentPrice) / currentPrice) * 100;
        return { text: `${formatSignedPercent(diff)} kaldı`, isReached: false };
    }

    if (targetPrice >= currentPrice) return { text: 'Hedefe ulaşıldı', isReached: true };
    const diff = ((currentPrice - targetPrice) / currentPrice) * 100;
    return { text: `${formatSignedPercent(-diff)} kaldı`, isReached: false };
}

export default function AlertCard({ alert, onDelete }: AlertCardProps) {
    const isAbove = alert.direction === 'ABOVE';
    const distance = getDistance(alert);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`relative bg-surface/60 border rounded-2xl p-5 flex flex-col justify-between transition-colors duration-200 hover:border-white/20 ${
                alert.isTriggered ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-white/5'
            }`}
        >
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/assets/${encodeURIComponent(alert.symbol)}`}
                                className="text-base font-black text-foreground hover:text-primary transition flex items-center gap-1 group"
                            >
                                {alert.symbol}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-primary" />
                            </Link>
                            <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 ${
                                    isAbove
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                            >
                                {isAbove ? (
                                    <>
                                        <ArrowUpRight className="w-3 h-3" /> Fiyat Yükselirse
                                    </>
                                ) : (
                                    <>
                                        <ArrowDownRight className="w-3 h-3" /> Fiyat Düşerse
                                    </>
                                )}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">{alert.assetName}</p>
                    </div>

                    <button
                        onClick={() => onDelete(alert.id)}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center cursor-pointer"
                        title="Alarmı Sil"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                            Son Fiyat
                        </span>
                        <span className="text-sm font-bold text-foreground mt-0.5 block">
                            {alert.currentPrice > 0 ? formatPriceTR(alert.currentPrice) : '— ₺'}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                            Hedef Fiyat
                        </span>
                        <span className={`text-sm font-bold mt-0.5 block ${isAbove ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPriceTR(alert.targetPrice)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-white/5">
                {alert.isTriggered ? (
                    <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Hedefe ulaştı</span>
                        </div>
                        {alert.triggeredAt && (
                            <span className="text-[10px] text-emerald-400/80">{formatDate(alert.triggeredAt)}</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Hedefe Mesafe:
                        </span>
                        <span className={`font-black ${distance.isReached ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {distance.text}
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
