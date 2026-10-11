import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TITLE_SIZES = {
    md: 'text-[1.375rem] sm:text-section', // 22 / 24px: ana sütundaki bölümler
    sm: 'text-xl',                         // 20px: dar yan sütundaki bölümler
} as const;

export interface SectionProps {
    title: ReactNode;
    description?: ReactNode; // başlığın altında tek kısa satır; çoğu bölümde gerekmez
    action?: ReactNode;      // sağda küçük kontroller: SegmentedControl size="sm", "Tümü" bağlantısı, size="sm" Button
    size?: keyof typeof TITLE_SIZES;
    id?: string;             // bağlantı hedefi; verilirse başlık da bölümün erişilebilir adı olur
    className?: string;
    contentClassName?: string;
    children: ReactNode;
}

// Kutusuz bölüm: kalın display başlık + içerik. Bölümleri boşluk ayırır, çerçeve değil.
// Listeler/tablolar doğrudan sayfa zemininde, ince çizgilerle durur.
export default function Section({
    title,
    description,
    action,
    size = 'md',
    id,
    className,
    contentClassName,
    children,
}: SectionProps) {
    const titleId = id ? `${id}-baslik` : undefined;

    return (
        <section id={id} aria-labelledby={titleId} className={cn('flex flex-col gap-4 min-w-0', className)}>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-1 min-w-0">
                    <h2
                        id={titleId}
                        className={cn('font-display font-bold tracking-tight leading-tight text-fg', TITLE_SIZES[size])}
                    >
                        {title}
                    </h2>
                    {description && <p className="text-sm text-fg-muted">{description}</p>}
                </div>
                {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
            </div>
            <div className={cn('flex flex-col min-w-0', contentClassName)}>{children}</div>
        </section>
    );
}
