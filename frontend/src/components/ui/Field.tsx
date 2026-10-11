import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps {
    label?: ReactNode;
    htmlFor?: string;    // etiketin bağlanacağı input id'si
    hint?: ReactNode;    // alttaki açıklama
    error?: ReactNode;   // verilirse hint yerine kırmızı hata metni çıkar
    labelAction?: ReactNode; // etiket satırının sağı: hızlı seçim düğmeleri vb.
    required?: boolean;
    className?: string;
    children: ReactNode;
}

// Etiket + alan + açıklama/hata sarmalayıcısı
export default function Field({ label, htmlFor, hint, error, labelAction, required, className, children }: FieldProps) {
    return (
        <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
            {(label || labelAction) && (
                <div className="flex flex-wrap items-center justify-between gap-2 min-h-6">
                    {label && (
                        <label htmlFor={htmlFor} className="text-13 font-medium text-fg">
                            {label}
                            {required && <span className="text-loss" aria-hidden> *</span>}
                        </label>
                    )}
                    {labelAction}
                </div>
            )}
            {children}
            {error ? (
                <p className="text-13 text-loss" role="alert">{error}</p>
            ) : hint ? (
                <p className="text-xs text-fg-muted">{hint}</p>
            ) : null}
        </div>
    );
}
