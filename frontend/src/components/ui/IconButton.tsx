import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type IconButtonVariant = 'ghost' | 'secondary' | 'primary';
type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
    icon: ReactNode;
    label: string; // ekran okuyucu ve ipucu metni
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    active?: boolean; // açık menü vb. için basılı görünüm
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
    ghost: 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
    secondary: 'bg-surface-2 border-border text-fg-muted hover:bg-surface-3 hover:text-fg',
    primary: 'bg-primary border-transparent text-on-primary hover:bg-primary-hover',
};

// Dokunma hedefi: mobilde en az 44px, masaüstünde en az 40px
const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: 'size-11 sm:size-10 [&_svg]:size-[18px]',
    md: 'size-11 [&_svg]:size-5',
};

export default function IconButton({
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    active = false,
    type = 'button',
    title,
    className,
    ...rest
}: IconButtonProps) {
    return (
        <button
            type={type}
            aria-label={label}
            title={title ?? label}
            className={cn(
                'relative inline-flex items-center justify-center shrink-0 rounded border cursor-pointer',
                'transition-colors duration-[120ms]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                VARIANT_CLASSES[variant],
                SIZE_CLASSES[size],
                active && 'bg-surface-3 text-fg',
                className,
            )}
            {...rest}
        >
            {icon}
        </button>
    );
}
