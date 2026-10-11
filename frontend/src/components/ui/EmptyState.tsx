import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
    icon: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode; // genellikle tek bir birincil Button
    className?: string;
}

// Sade boş durum: küçük gri simge, tek satır başlık, kısa açıklama
export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}>
            <span className="flex text-fg-subtle [&_svg]:size-6" aria-hidden>
                {icon}
            </span>
            <div className="flex flex-col items-center gap-1 max-w-sm">
                <p className="text-base font-medium text-fg">{title}</p>
                {description && <p className="text-sm text-fg-muted leading-relaxed">{description}</p>}
            </div>
            {action && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}</div>}
        </div>
    );
}
