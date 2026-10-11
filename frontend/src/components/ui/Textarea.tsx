import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { fieldClasses } from './fieldStyles';

export interface TextareaProps extends ComponentProps<'textarea'> {
    invalid?: boolean;
}

export default function Textarea({ invalid = false, className, rows = 3, ...rest }: TextareaProps) {
    return (
        <textarea
            rows={rows}
            aria-invalid={invalid || undefined}
            className={fieldClasses(invalid, cn('px-3 py-2.5 leading-normal resize-y min-h-20', className))}
            {...rest}
        />
    );
}
