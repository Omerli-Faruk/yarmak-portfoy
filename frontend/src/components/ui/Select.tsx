import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fieldClasses } from './fieldStyles';

export interface SelectProps extends ComponentProps<'select'> {
    invalid?: boolean;
    containerClassName?: string;
}

// Yerel <select>; seçenekler children olarak <option> verilir
export default function Select({ invalid = false, containerClassName, className, children, ...rest }: SelectProps) {
    return (
        <div className={cn('relative flex items-center w-full min-w-0', containerClassName)}>
            <select
                aria-invalid={invalid || undefined}
                className={fieldClasses(invalid, cn('h-11 sm:h-10 pl-3 pr-9 appearance-none cursor-pointer', className))}
                {...rest}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-4 text-fg-muted" aria-hidden />
        </div>
    );
}
