'use client';

import { Bell, CheckCircle2, Clock, type LucideIcon } from 'lucide-react';

interface AlertStatsCardsProps {
    totalCount: number;
    pendingCount: number;
    triggeredCount: number;
}

interface StatCard {
    label: string;
    value: number;
    note: string;
    icon: LucideIcon;
    valueClass: string;
}

export default function AlertStatsCards({ totalCount, pendingCount, triggeredCount }: AlertStatsCardsProps) {
    const cards: StatCard[] = [
        { label: 'Toplam Alarm', value: totalCount, note: 'kayıtlı', icon: Bell, valueClass: 'text-foreground' },
        { label: 'Bekleyen Alarmlar', value: pendingCount, note: 'hedef bekleniyor', icon: Clock, valueClass: 'text-amber-400' },
        { label: 'Tetiklenenler', value: triggeredCount, note: 'hedefe ulaştı', icon: CheckCircle2, valueClass: 'text-emerald-400' },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
            {cards.map(({ label, value, note, icon: Icon, valueClass }) => (
                <div key={label} className="bg-surface/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
                        <div className="w-8 h-8 rounded-lg bg-surface/80 border border-white/10 text-slate-300 flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className={`text-2xl sm:text-3xl font-black ${valueClass}`}>{value}</span>
                        <span className="text-xs text-slate-400">{note}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
