import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatSignedPercent } from '@/lib/formatters';

export type ChangePillVariant = 'text' | 'soft';

export interface ChangePillProps {
    value: number;          // yüzde değişim (2.4 => "+%2,40"); renk ve ok bu değere göre seçilir
    decimals?: number;
    size?: 'sm' | 'md';
    showIcon?: boolean;     // ▲ / ▼ işareti
    variant?: ChangePillVariant; // 'text' (varsayılan): zeminsiz renkli mono yazı; 'soft': küçük renkli etiket
    amount?: ReactNode;     // verilirse önce tutar, sonra parantez içinde yüzde: "+1.250,00 ₺ (+%2,40)"
    children?: ReactNode;   // verilirse yüzde yerine bu yazılır (örn. "+1.250,00 ₺"); işaret çağırana aittir
    className?: string;
    title?: string;
}

// Baştaki kısa çizgi mono yazıda gerçek eksi işaretiyle (−) değiştirilir
function withTrueMinus(node: ReactNode): ReactNode {
    return typeof node === 'string' ? node.replace(/^-/, '−') : node;
}

// Kâr/zarar göstergesi: renk tek başına bilgi taşımaz, işaret ve ok da gösterilir.
// Örnek: "▲ +%2,40" / "▼ −%0,12" / "▲ +1.250,00 ₺ (+%2,40)"
export default function ChangePill({
    value,
    decimals = 2,
    size = 'sm',
    showIcon = true,
    variant = 'text',
    amount,
    children,
    className,
    title,
}: ChangePillProps) {
    const rounded = isFinite(value) ? Number(value.toFixed(decimals)) : 0;
    const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
    const pct = formatSignedPercent(value, decimals);
    const text = amount !== undefined
        ? <>{withTrueMinus(amount)} ({pct})</>
        : (children !== undefined ? withTrueMinus(children) : pct);
    const isSoft = variant === 'soft';

    return (
        <span
            title={title}
            className={cn(
                // Yazı hâlinde ok rakamlarla aynı taban çizgisine oturur; renkli etikette kutunun ortasında durur
                'inline-flex gap-1 shrink-0 font-mono font-medium tabular-nums whitespace-nowrap',
                isSoft ? 'items-center' : 'items-baseline',
                // v3.1: tablo sayılarıyla aynı 15px; md (kahraman satırı) 16px
                size === 'sm' ? 'text-sm' : 'text-base',
                direction === 'up' && 'text-profit',
                direction === 'down' && 'text-loss',
                direction === 'flat' && 'text-fg-muted',
                isSoft && (size === 'sm' ? 'h-6 px-1.5 rounded' : 'h-7 px-2 rounded'),
                isSoft && direction === 'up' && 'bg-profit-soft',
                isSoft && direction === 'down' && 'bg-loss-soft',
                isSoft && direction === 'flat' && 'bg-surface-2',
                className,
            )}
        >
            {/* Ok sabit genişlikte; değişim yoksa boş yer tutar, böylece alt alta değerler hizalı kalır */}
            {showIcon && (
                <span aria-hidden className="inline-block w-[1em] shrink-0 text-center text-[0.9em] leading-none">
                    {direction === 'up' ? '▲' : direction === 'down' ? '▼' : ''}
                </span>
            )}
            {text}
        </span>
    );
}
