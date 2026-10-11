import { cn } from '@/lib/cn';

// Yükleme yer tutucusu; boyutu className ile verilir (örn. "h-4 w-32")
export default function Skeleton({ className }: { className?: string }) {
    return <div aria-hidden className={cn('bg-surface-2 animate-pulse rounded', className)} />;
}
