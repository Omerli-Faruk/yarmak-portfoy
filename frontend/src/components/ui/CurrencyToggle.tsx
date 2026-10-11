'use client';

import type { Currency } from '@/hooks/useCurrency';
import { cn } from '@/lib/cn';

interface CurrencyToggleProps {
    currency: Currency;
    onToggle: () => void;
    disabled?: boolean; // kur bilgisi yoksa true verin
    className?: string;
}

const OPTIONS: { value: Currency; label: string }[] = [
    { value: 'TRY', label: '₺ TRY' },
    { value: 'USD', label: '$ USD' },
];

// TRY / USD geçiş düğmesi (Portföyüm ve Varlıklarım üst bölümü). Tek düğmedir; tıklayınca diğer birime geçer.
// Görünümü SegmentedControl ile aynıdır.
export default function CurrencyToggle({ currency, onToggle, disabled = false, className = '' }: CurrencyToggleProps) {
    // Kur yokken tutarlar TL gösterildiği için düğme de TL göstersin
    const shown: Currency = disabled ? 'TRY' : currency;

    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            title={disabled ? 'Kur bilgisi alınamadı' : 'Tüm değerleri dolar veya TL cinsinden görüntüle'}
            className={cn(
                'inline-flex items-center gap-px p-0.5 rounded border border-border bg-surface-2 text-13 font-medium shrink-0',
                'transition-colors duration-[120ms]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
                className,
            )}
        >
            <span className="sr-only">Para Birimi: {shown}</span>
            {OPTIONS.map(option => (
                <span
                    key={option.value}
                    aria-hidden
                    className={cn(
                        'flex items-center h-10 sm:h-9 px-3 rounded-[3px] whitespace-nowrap font-mono transition-colors duration-[120ms]',
                        option.value === shown ? 'bg-surface-3 text-fg ring-1 ring-inset ring-border-strong' : 'text-fg-muted',
                    )}
                >
                    {option.label}
                </span>
            ))}
        </button>
    );
}
