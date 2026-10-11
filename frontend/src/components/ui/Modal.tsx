'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import IconButton from './IconButton';

const SIZE_CLASSES = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
} as const;

const ICON_TONE_CLASSES = {
    primary: 'text-primary',
    loss: 'text-loss',
    warning: 'text-warning',
} as const;

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    iconTone?: keyof typeof ICON_TONE_CLASSES;
    size?: keyof typeof SIZE_CLASSES;
    footer?: ReactNode;       // alt düğmeler; mobilde alt alta, masaüstünde sağa yaslı
    dismissible?: boolean;    // false iken Esc, arka plan ve X kapatmaz (kayıt sürerken)
    className?: string;
    children?: ReactNode;
}

// Düz panel: başlık çubuğu + gövde + alt çubuk. Masaüstünde ortada, mobilde alttan açılır. Esc ile kapanır.
export default function Modal({
    open,
    onClose,
    title,
    description,
    icon,
    iconTone = 'primary',
    size = 'md',
    footer,
    dismissible = true,
    className,
    children,
}: ModalProps) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    const dismissibleRef = useRef(dismissible);

    useEffect(() => {
        onCloseRef.current = onClose;
        dismissibleRef.current = dismissible;
    }, [onClose, dismissible]);

    // Açılınca odak pencereye alınır, sayfa kaydırması kilitlenir; kapanınca eski odak geri verilir
    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const panel = panelRef.current;
        if (panel && !panel.contains(document.activeElement)) panel.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dismissibleRef.current) {
                e.stopPropagation();
                onCloseRef.current();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previouslyFocused?.focus?.();
        };
    }, [open]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            {/* Karartma katmanı */}
            <div
                aria-hidden
                className="absolute inset-0 bg-black/60"
                onClick={() => dismissible && onClose()}
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    'relative flex w-full max-h-[92dvh] flex-col bg-surface border border-border outline-none',
                    'rounded-t-md sm:rounded-md',
                    SIZE_CLASSES[size],
                    className,
                )}
            >
                <div className="flex items-start justify-between gap-3 pl-4 pr-2 py-2 border-b border-border">
                    <div className="flex items-start gap-2 min-w-0 py-1">
                        {icon && (
                            <span className={cn('flex shrink-0 pt-1 [&_svg]:size-[18px]', ICON_TONE_CLASSES[iconTone])} aria-hidden>
                                {icon}
                            </span>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-fg">{title}</h2>
                            {description && <p className="text-13 text-fg-muted">{description}</p>}
                        </div>
                    </div>
                    <IconButton
                        icon={<X />}
                        label="Kapat"
                        size="sm"
                        disabled={!dismissible}
                        onClick={onClose}
                    />
                </div>

                {children && (
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto custom-scrollbar px-4 py-4 text-sm">
                        {children}
                    </div>
                )}

                {footer && (
                    <div className="flex flex-col-reverse gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:pb-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
