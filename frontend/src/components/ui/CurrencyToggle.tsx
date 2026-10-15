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
                'group inline-flex items-center gap-1 rounded text-13 font-medium shrink-0',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                className,
            )}
        >
            <span className="sr-only">Para Birimi: {shown}</span>
            {OPTIONS.map(option => (
                <span
                    key={option.value}
                    aria-hidden
                    className={cn(
                        'flex items-center h-11 sm:h-10 px-3 rounded whitespace-nowrap font-mono transition-colors duration-[120ms]',
                        option.value === shown
                            ? 'bg-primary-soft text-primary'
                            : cn('text-fg-muted', !disabled && 'group-hover:bg-surface-2 group-hover:text-fg'),
                    )}
                >
                    {option.label}
                </span>
            ))}
        </button>
    );
}
