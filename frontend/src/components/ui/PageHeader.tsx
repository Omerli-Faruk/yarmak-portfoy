import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode; // sağda (mobilde altta) duran düğmeler
    className?: string;
}

// Sayfa başlığı: display yazı 30/32px kalın. Altında en çok bir kısa satır; rozet, simge, üst etiket eklemeyin.
export default function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="flex flex-col gap-1.5 min-w-0">
                <h1 className="font-display text-[1.875rem] leading-[2.375rem] sm:text-title font-bold tracking-display text-fg">{title}</h1>
                {subtitle && <p className="text-base text-fg-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
