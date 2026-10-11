import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { splitCurrencySymbol } from '@/lib/formatters';

const VALUE_SIZES = {
    lg: 'text-[2.375rem] sm:text-5xl lg:text-hero', // 38 / 48 / 56px: sayfanın tek odak sayısı
    md: 'text-[2rem] sm:text-[2.5rem]',             // 32 / 40px: ikincil sayfalardaki ana değer
} as const;

export interface HeroProps {
    label?: ReactNode;          // değerin üstündeki kısa etiket ("Toplam portföy değeri")
    value: ReactNode;           // "1.234,56 ₺" gibi metin verilirse para simgesi kendiliğinden soluk yazılır
    currencySuffix?: ReactNode; // simgeyi elle vermek için (değerin sağında, soluk). Verilirse otomatik ayırma yapılmaz
    sub?: ReactNode;            // değerin altındaki tek mono satır: değişimler (HeroMeta ile)
    aside?: ReactNode;          // sağ taraf (mobilde alt): para birimi seçici, küçük düğmeler
    size?: keyof typeof VALUE_SIZES;
    valueClassName?: string;    // örn. kâr/zarar rengi
    className?: string;
    children?: ReactNode;       // altta tam genişlik: sayfanın ana grafiği (InteractiveAreaChart frameless)
}

// Sayfanın tek odak noktası: büyük display sayı, altında bir satır değişim, isteğe bağlı grafik. Kutusuz.
export default function Hero({
    label,
    value,
    currencySuffix,
    sub,
    aside,
    size = 'lg',
    valueClassName,
    className,
    children,
}: HeroProps) {
    return (
        <section className={cn('flex flex-col gap-6 min-w-0', className)}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-2 min-w-0">
                    {label && <span className="text-base text-fg-muted">{label}</span>}
                    <p
                        className={cn(
                            'font-display font-bold tracking-display tabular-nums leading-none break-words text-fg',
                            VALUE_SIZES[size],
                            valueClassName,
                        )}
                    >
                        <HeroValue value={value} currencySuffix={currencySuffix} />
                    </p>
                    {sub && (
                        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 pt-1 font-mono text-base">
                            {sub}
                        </div>
                    )}
                </div>
                {aside && <div className="flex flex-col gap-2 min-w-0 lg:items-end shrink-0">{aside}</div>}
            </div>
            {children}
        </section>
    );
}

// Para simgesi sayıdan küçük ve soluk durur
function CurrencyMark({ children, first }: { children: ReactNode; first?: boolean }) {
    return (
        <span className={cn('text-[0.6em] font-medium text-fg-subtle', first ? 'mr-1' : 'ml-1.5')}>{children}</span>
    );
}

function HeroValue({ value, currencySuffix }: { value: ReactNode; currencySuffix?: ReactNode }) {
    if (currencySuffix !== undefined && currencySuffix !== null) {
        return <>{value}<CurrencyMark>{currencySuffix}</CurrencyMark></>;
    }
    if (typeof value !== 'string') return <>{value}</>;

    const { sign, number, symbol, symbolFirst } = splitCurrencySymbol(value);
    if (!symbol) return <>{value}</>;
    return symbolFirst
        ? <>{sign}<CurrencyMark first>{symbol}</CurrencyMark>{number}</>
        : <>{sign}{number}<CurrencyMark>{symbol}</CurrencyMark></>;
}

export interface HeroMetaProps {
    label: ReactNode;
    children: ReactNode; // genellikle ChangePill'ler
    className?: string;
}

// Kahraman sayının altındaki satırın bir parçası: "Toplam getiri ▲ +8.250,00 ₺ (+%12,40)"
export function HeroMeta({ label, children, className }: HeroMetaProps) {
    return (
        <span className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0', className)}>
            <span className="font-sans text-13 text-fg-muted whitespace-nowrap">{label}</span>
            {children}
        </span>
    );
}
