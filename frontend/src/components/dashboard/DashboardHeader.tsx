'use client';

import { RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';

interface DashboardHeaderProps {
    username?: string;
    refreshing: boolean;
    onRefresh: () => void;
}

// Sayfa başlığı: solda başlık ve karşılama, sağda yazılı yenile düğmesi.
// Gecikme notu sayfanın altındaki veri kaynağı satırında bir kez yazılır.
export default function DashboardHeader({ username, refreshing, onRefresh }: DashboardHeaderProps) {
    return (
        <PageHeader
            title="Portföy genel bakış"
            subtitle={username ? <>Hoş geldiniz, <span className="font-medium text-fg">{username}</span>.</> : undefined}
            actions={
                <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />}
                    title="Portföyü yenile (önbelleği temizle)"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    Yenile
                </Button>
            }
        />
    );
}
