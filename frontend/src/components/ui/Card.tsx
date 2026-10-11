import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends ComponentProps<'div'> {
    padded?: boolean; // false verilirse iç boşluk eklenmez (tablo, liste gibi kenara dayanan içerik için)
}

// Sakin panel (v3): yüzey rengi + 1px ince çizgi, gölge yok. Sayfalarda varsayılan olarak Section kullanın;
// Card yalnızca gerçekten ayrı bir nesne olan içerik için (form kutusu, seçili öğe özeti). Ekranda en çok 1–2 tane.
// Doğrudan çocuk olan CardHeader, iç boşluklu panelde de kenardan kenara uzanır.
export default function Card({ padded = true, className, children, ...rest }: CardProps) {
    return (
        <div
            className={cn(
                'flex flex-col min-w-0 bg-surface border border-border rounded-md',
                padded && 'px-3 py-3 sm:px-4 [&>[data-card-header]]:-mx-3 [&>[data-card-header]]:-mt-3 sm:[&>[data-card-header]]:-mx-4',
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}

export interface CardHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode; // sağ taraf: küçük buton, segment seçici vb.
    className?: string;
}

// Panelin üst satırı: solda başlık, sağda küçük eylemler. Alt çizgisi yok; içerikten boşlukla ayrılır.
export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
    return (
        <div
            data-card-header=""
            className={cn(
                'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 min-h-11 px-3 sm:px-4 pt-2 pb-1',
                className,
            )}
        >
            <div className="flex items-baseline gap-2 min-w-0">
                {icon && <span className="flex self-center shrink-0 text-fg-subtle [&_svg]:size-3.5" aria-hidden>{icon}</span>}
                <h2 className="text-base font-semibold tracking-tight text-fg truncate">{title}</h2>
                {subtitle && <span className="text-xs text-fg-subtle truncate">{subtitle}</span>}
            </div>
            {action && <div className="flex items-center gap-1.5 shrink-0">{action}</div>}
        </div>
    );
}
