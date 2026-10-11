import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import Card from './Card';
import ChangePill from './ChangePill';

export interface StatCardProps {
    label: ReactNode;
    value: ReactNode;
    change?: number;         // verilirse değerin yanında renkli yüzde çıkar
    hint?: ReactNode;        // alt satır: açıklama veya ikincil tutar
    icon?: ReactNode;
    valueClassName?: string; // örn. kâr/zarar rengi için "text-profit"
    className?: string;
}

// Küçük metrik paneli: etiket, mono değer, değişim.
// v3: yan yana StatCard ızgarası kurmayın; ikincil rakamlar için SummaryStrip kullanın.
export default function StatCard({ label, value, change, hint, icon, valueClassName, className }: StatCardProps) {
    return (
        <Card className={cn('gap-1', className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-subtle">{label}</span>
                {icon && <span className="flex text-fg-subtle [&_svg]:size-3.5" aria-hidden>{icon}</span>}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={cn('font-mono text-lg sm:text-xl font-medium tabular-nums break-words', valueClassName ?? 'text-fg')}>{value}</span>
                {change !== undefined && <ChangePill value={change} />}
            </div>
            {hint && <div className="text-xs text-fg-subtle">{hint}</div>}
        </Card>
    );
}
