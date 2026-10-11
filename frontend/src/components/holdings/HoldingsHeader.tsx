'use client';

import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { Currency } from '@/hooks/useCurrency';
import { cn } from '@/lib/cn';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

interface HoldingsHeaderProps {
    currency: Currency;
    currencyDisabled: boolean;
    onToggleCurrency: () => void;
    onAddTx: () => void;
    refreshing: boolean;
    onRefresh: () => void;
}

// Sayfa başlığı ve sağda sade eylemler: para birimi, yenileme ve sayfanın tek birincil düğmesi (İşlem ekle).
// Portföyüm'e dönüş üst menüde olduğu için başlıkta ayrı bir geri bağlantısı yok.
export default function HoldingsHeader({
    currency,
    currencyDisabled,
    onToggleCurrency,
    onAddTx,
    refreshing,
    onRefresh,
}: HoldingsHeaderProps) {
    return (
        <PageHeader
            title="Varlıklarım"
            actions={
                <>
                    <CurrencyToggle currency={currency} onToggle={onToggleCurrency} disabled={currencyDisabled} />
                    <IconButton
                        icon={<RefreshCw className={cn(refreshing && 'animate-spin text-primary')} />}
                        label="Fiyatları yenile"
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={refreshing}
                    />
                    <Button size="sm" leftIcon={<Plus />} onClick={onAddTx}>
                        İşlem ekle
                    </Button>
                </>
            }
        />
    );
}
