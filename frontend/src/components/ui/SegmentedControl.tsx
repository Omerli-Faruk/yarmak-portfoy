import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
    disabled?: boolean;
    title?: string;
}

export interface SegmentedControlProps<T extends string> {
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    variant?: 'segment' | 'underline'; // underline: sayfa düzeyindeki sekmeler için
    mono?: boolean;      // dönem kısaltmaları (1G, 1H, 1A) gibi etiketler için mono yazı
    fullWidth?: boolean; // seçenekler genişliği eşit paylaşır
    ariaLabel?: string;
    className?: string;
}

// Dönem, sekme ve görünüm seçicisi. Sığmazsa yatay kayar.
// Her seçenek dokunma hedefi: mobilde en az 44px, masaüstünde en az 40px yüksek.
export default function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    size = 'md',
    variant = 'segment',
    mono = false,
    fullWidth = false,
    ariaLabel,
    className,
}: SegmentedControlProps<T>) {
    const isUnderline = variant === 'underline';

    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={cn(
                'flex max-w-full overflow-x-auto no-scrollbar',
                isUnderline
                    ? 'gap-6 border-b border-border'
                    : 'gap-px p-0.5 rounded bg-surface-2 border border-border',
                fullWidth ? 'w-full' : 'w-fit',
                className,
            )}
        >
            {options.map(option => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        title={option.title}
                        disabled={option.disabled}
                        aria-pressed={isActive}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex items-center justify-center gap-1.5 shrink-0 font-medium whitespace-nowrap cursor-pointer',
                            'transition-colors duration-[120ms] [&_svg]:size-4',
                            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                            'disabled:opacity-40 disabled:cursor-not-allowed',
                            mono && 'font-mono',
                            fullWidth && 'flex-1',
                            isUnderline
                                ? cn(
                                    '-mb-px border-b-2 px-1',
                                    size === 'sm' ? 'h-11 sm:h-10 text-sm' : 'h-12 sm:h-11 text-base',
                                    isActive ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                                )
                                : cn(
                                    'rounded-[3px]',
                                    size === 'sm'
                                        ? 'h-11 sm:h-10 min-w-11 sm:min-w-10 px-2 text-13'
                                        : 'h-11 sm:h-10 min-w-11 sm:min-w-10 px-3.5 text-sm',
                                    isActive
                                        ? 'bg-surface-3 text-fg ring-1 ring-inset ring-border-strong'
                                        : 'text-fg-muted hover:text-fg',
                                ),
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
