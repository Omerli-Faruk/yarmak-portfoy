import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { fieldClasses } from './fieldStyles';

export interface InputProps extends ComponentProps<'input'> {
    invalid?: boolean;
    leftIcon?: ReactNode;  // örn. arama simgesi
    rightSlot?: ReactNode; // örn. birim ("₺", "adet") veya temizle düğmesi
    containerClassName?: string;
}

// ref, React 19'da normal prop olarak iletilir. Sayısal alanlar kendiliğinden mono yazılır.
export default function Input({ invalid = false, leftIcon, rightSlot, containerClassName, className, ...rest }: InputProps) {
    const isNumeric = rest.type === 'number' || rest.inputMode === 'decimal' || rest.inputMode === 'numeric';
    const input = (
        <input
            aria-invalid={invalid || undefined}
            className={fieldClasses(invalid, cn(
                'h-11 sm:h-10 px-3',
                isNumeric && 'font-mono',
                !!leftIcon && 'pl-10',
                !!rightSlot && 'pr-14',
                className,
            ))}
            {...rest}
        />
    );

    if (!leftIcon && !rightSlot) {
        return containerClassName ? <div className={containerClassName}>{input}</div> : input;
    }

    return (
        <div className={cn('relative flex items-center w-full min-w-0', containerClassName)}>
            {leftIcon && (
                <span className="pointer-events-none absolute left-3 flex items-center text-fg-subtle [&_svg]:size-[18px]">
                    {leftIcon}
                </span>
            )}
            {input}
            {rightSlot && (
                <span className="absolute right-3 flex items-center text-13 text-fg-muted">
                    {rightSlot}
                </span>
            )}
        </div>
    );
}
