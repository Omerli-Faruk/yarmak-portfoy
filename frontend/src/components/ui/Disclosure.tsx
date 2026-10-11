import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DisclosureProps {
    summary: ReactNode;    // tıklanan satır, genellikle "Detaylar"
    defaultOpen?: boolean;
    className?: string;
    contentClassName?: string;
    children: ReactNode;
}

// Seyrek gereken bilgiler için açılır bölüm. Tarayıcının <details> öğesi: JS gerektirmez, klavyeyle çalışır.
export default function Disclosure({ summary, defaultOpen = false, className, contentClassName, children }: DisclosureProps) {
    return (
        <details className={cn('group min-w-0', className)} open={defaultOpen || undefined}>
            <summary
                className={cn(
                    'flex items-center gap-1.5 w-fit min-h-11 sm:min-h-10 cursor-pointer select-none list-none rounded',
                    'text-sm font-medium text-fg-muted hover:text-fg transition-colors duration-[120ms]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    '[&::-webkit-details-marker]:hidden',
                )}
            >
                <ChevronRight className="size-4 text-fg-subtle group-open:rotate-90" aria-hidden />
                {summary}
            </summary>
            <div className={cn('flex flex-col gap-3 pt-2', contentClassName)}>{children}</div>
        </details>
    );
}
