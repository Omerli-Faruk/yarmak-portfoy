import type { ComponentProps, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-on-primary border-transparent hover:bg-primary-hover',
    secondary: 'bg-surface-2 text-fg border-border hover:bg-surface-3 hover:border-border-strong',
    ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-surface-2 hover:text-fg',
    // Koyu temada koyu, açık temada beyaz yazı; iki temada da kırmızı zemin üzerinde 4.5:1 üzeri
    danger: 'bg-loss text-on-primary border-transparent hover:opacity-90',
};

// Dokunma hedefi: mobilde en az 44px, masaüstünde en az 40px (v3.1 okunabilirlik)
const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'h-11 sm:h-10 px-3.5 text-13 gap-1.5 [&_svg]:size-4',
    md: 'h-11 px-4 text-sm gap-2 [&_svg]:size-[18px]',
};

interface ButtonClassOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    className?: string;
}

// Link gibi buton olmayan öğelere de aynı görünümü vermek için
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false, className }: ButtonClassOptions = {}): string {
    return cn(
        'inline-flex items-center justify-center shrink-0 rounded border font-medium whitespace-nowrap',
        'transition-colors duration-[120ms] cursor-pointer select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
    );
}

export interface ButtonProps extends ComponentProps<'button'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    loading?: boolean; // true iken simge yerine dönen gösterge çıkar ve buton pasifleşir
}

export default function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    leftIcon,
    rightIcon,
    loading = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={buttonClasses({ variant, size, fullWidth, className })}
            {...rest}
        >
            {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
}
