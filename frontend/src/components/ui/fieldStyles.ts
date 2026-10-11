import { cn } from '@/lib/cn';

// Input, Select ve Textarea'nın ortak görünümü: 4px köşe, surface-2 zemin, odakta primary çizgi (büyük halka yok).
// Yazı 16px: okunur ve iOS'ta odaklanınca sayfa yakınlaşmaz.
export function fieldClasses(invalid: boolean, className?: string): string {
    return cn(
        'w-full min-w-0 rounded bg-surface-2 border text-base text-fg placeholder:text-fg-subtle',
        'transition-colors duration-[120ms] outline-none',
        'focus:border-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid ? 'border-loss' : 'border-border hover:border-border-strong',
        className,
    );
}
