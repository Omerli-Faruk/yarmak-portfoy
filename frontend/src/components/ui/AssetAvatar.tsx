import { cn } from '@/lib/cn';

const SIZE_CLASSES = {
    sm: 'size-8 text-xs',  // 32px, 2 harf
    md: 'size-9 text-xs',  // 36px, 3 harf
    lg: 'size-11 text-13', // 44px
} as const;

export interface AssetAvatarProps {
    symbol: string;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

// Sembolün ilk harfleriyle küçük yuvarlak simge (ör. THYAO -> "THY")
export default function AssetAvatar({ symbol, size = 'md', className }: AssetAvatarProps) {
    const letters = symbol.replace(/[^\p{L}\p{N}]/gu, '').toLocaleUpperCase('tr-TR');
    const initials = letters.slice(0, size === 'sm' ? 2 : 3) || '?';

    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex items-center justify-center shrink-0 rounded-full border border-border bg-surface-2 font-mono font-medium text-fg-muted',
                SIZE_CLASSES[size],
                className,
            )}
        >
            {initials}
        </span>
    );
}
