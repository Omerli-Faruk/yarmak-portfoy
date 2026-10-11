import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SummaryTone = 'default' | 'muted' | 'profit' | 'loss' | 'warning' | 'primary';

const TONE_CLASSES: Record<SummaryTone, string> = {
    default: 'text-fg',
    muted: 'text-fg-muted',
    profit: 'text-profit',
    loss: 'text-loss',
    warning: 'text-warning',
    primary: 'text-primary',
};

export interface SummaryStripItem {
    label: ReactNode;
    value: ReactNode;  // mono yazılır; ChangePill de verilebilir
    hint?: ReactNode;  // değerin altında küçük soluk satır
    tone?: SummaryTone; // değerin yazı rengi (kâr/zarar için profit/loss)
    title?: string;     // üzerine gelince çıkan açıklama
}

export interface SummaryStripProps {
    items: ReadonlyArray<SummaryStripItem>;
    ariaLabel?: string;
    className?: string;
}

// Tailwind sınıfları derlemede taranır; bu yüzden her kırılım için tam sınıf adları yazıldı.
// Satır başındaki hücrede sol çizgi ve sol boşluk yok, böylece metin sayfa kenarıyla hizalı kalır.
const ROW_START = ['border-l-0 pl-0', 'sm:border-l-0 sm:pl-0', 'lg:border-l-0 lg:pl-0'] as const;
const ROW_REST = ['border-l pl-4', 'sm:border-l sm:pl-4', 'lg:border-l lg:pl-4'] as const;
const FIRST_ROW = ['border-t-0', 'sm:border-t-0', 'lg:border-t-0'] as const;
const NEXT_ROW = ['border-t', 'sm:border-t', 'lg:border-t'] as const;

// Kahramanın altındaki tek özet şeridi: etiket/değer hücreleri, ince çizgilerle ayrılır, kutu yok.
// Mobilde ikişerli; sm'de en çok 4 hücre tek satır (fazlası üçerli); lg'de hepsi tek satır.
export default function SummaryStrip({ items, ariaLabel, className }: SummaryStripProps) {
    const n = items.length;
    if (n === 0) return null;
    const columns = [Math.min(2, n), n <= 4 ? n : 3, n];

    return (
        <dl aria-label={ariaLabel} className={cn('flex flex-wrap border-y border-border', className)}>
            {items.map((item, i) => (
                <div
                    key={i}
                    title={item.title}
                    className={cn(
                        'flex flex-col gap-1 min-w-0 py-3.5 pr-4 border-border',
                        n === 1 ? 'basis-full' : 'basis-1/2',
                        n <= 4 ? 'sm:basis-0 sm:grow' : 'sm:basis-1/3 sm:grow-0 lg:basis-0 lg:grow',
                        columns.map((c, bp) => (i % c === 0 ? ROW_START[bp] : ROW_REST[bp])).join(' '),
                        columns.map((c, bp) => (i < c ? FIRST_ROW[bp] : NEXT_ROW[bp])).join(' '),
                    )}
                >
                    <dt className="text-13 text-fg-muted truncate">{item.label}</dt>
                    <dd className={cn('font-mono text-base font-medium truncate', TONE_CLASSES[item.tone ?? 'default'])}>
                        {item.value}
                    </dd>
                    {item.hint && <dd className="text-xs text-fg-subtle truncate">{item.hint}</dd>}
                </div>
            ))}
        </dl>
    );
}
