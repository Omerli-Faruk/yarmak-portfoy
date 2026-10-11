import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'profit' | 'loss' | 'warning';

const TONE_CLASSES: Record<BadgeTone, string> = {
    neutral: 'bg-surface-2 text-fg-muted border-border',
    primary: 'bg-primary-soft text-primary border-transparent',
    profit: 'bg-profit-soft text-profit border-transparent',
    loss: 'bg-loss-soft text-loss border-transparent',
    warning: 'bg-warning-soft text-warning border-transparent',
};

export interface BadgeProps {
    tone?: BadgeTone;
    icon?: ReactNode;
    className?: string;
    title?: string;
    children: ReactNode;
}

// Küçük köşeli etiket (4px). Varsayılan nötr; renkli tonlar yalnızca tek seferlik durumlar için.
export default function Badge({ tone = 'neutral', icon, className, title, children }: BadgeProps) {
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1 shrink-0 h-6 px-2 rounded border text-xs font-medium whitespace-nowrap [&_svg]:size-3.5',
                TONE_CLASSES[tone],
                className,
            )}
        >
            {icon}
            {children}
        </span>
    );
}
