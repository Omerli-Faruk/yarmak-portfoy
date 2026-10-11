'use client';

import Hero, { HeroMeta } from '@/components/ui/Hero';
import Skeleton from '@/components/ui/Skeleton';

interface AlertStatsCardsProps {
    totalCount: number;
    pendingCount: number;
    triggeredCount: number;
    loading?: boolean;
}

// Sayfanın odak noktası: bekleyen alarm sayısı büyük yazılır, altında tek mono satırda tetiklenen ve toplam.
export default function AlertStatsCards({ totalCount, pendingCount, triggeredCount, loading = false }: AlertStatsCardsProps) {
    if (loading) {
        return (
            <div aria-busy className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-4 w-48" />
            </div>
        );
    }

    return (
        <Hero
            size="md"
            label="Bekleyen alarmlar"
            value={pendingCount}
            sub={
                <>
                    <HeroMeta label="Tetiklenenler">
                        <span className={triggeredCount > 0 ? 'text-profit' : 'text-fg'}>{triggeredCount}</span>
                    </HeroMeta>
                    <HeroMeta label="Toplam alarm">
                        <span className="text-fg">{totalCount}</span>
                    </HeroMeta>
                </>
            }
        />
    );
}
