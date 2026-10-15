'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import ChangePill from '@/components/ui/ChangePill';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Section from '@/components/ui/Section';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ASSET_TYPE_LABELS, formatPriceTR } from '@/lib/formatters';
import type { MarketAssetItem } from '@/types';

interface MarketLeaderColumnProps {
    title: string;
    items: MarketAssetItem[];
    loading: boolean;
    emptyText: string;
    keyPrefix: string;
    onQuickAdd: (item: MarketAssetItem) => void;
    className?: string;
}

// Yükselenler ve düşenler için aynı kutusuz liste: satırlar sayfa zemininde, ince çizgilerle ayrılır
export default function MarketLeaderColumn({
    title,
    items,
    loading,
    emptyText,
    keyPrefix,
    onQuickAdd,
    className,
}: MarketLeaderColumnProps) {
    return (
        <Section title={title} className={className}>
            {items.length === 0 ? (
                loading ? (
                    <div className="flex flex-col divide-y divide-border border-t border-border">
                        <span className="sr-only">Yükleniyor...</span>
                        {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="flex h-12 items-center gap-4">
                                <span className="flex flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-3.5 w-14" />
                                    <Skeleton className="h-3 w-28" />
                                </span>
                                <Skeleton className="h-3.5 w-16" />
                                <Skeleton className="h-3.5 w-14" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="border-t border-border py-6 text-sm text-fg-muted">{emptyText}</p>
                )
            ) : (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {items.map((item, idx) => (
                        <li
                            key={`${keyPrefix}-${item.id}-${item.symbol}-${idx}`}
                            className="flex h-12 items-center gap-2 transition-colors duration-[120ms] hover:bg-surface-2 sm:gap-3"
                        >
                            <Link
                                href={`/varlik/${item.symbol}`}
                                className={cn(
                                    'group flex h-full min-w-0 flex-1 items-center gap-3 rounded sm:gap-4',
                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                )}
                            >
                                {/* Solda sembol ve ad, sağda fiyat ve günlük değişim */}
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span className="truncate font-mono text-sm font-medium text-fg transition-colors duration-[120ms] group-hover:text-primary">
                                            {item.symbol}
                                        </span>
                                        {/* Listeler zaten hisse listesi; tür yalnızca hisse dışı varlıkta yazılır */}
                                        {item.asset_type !== 'HISSE' && (
                                            <Badge>{ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}</Badge>
                                        )}
                                    </span>
                                    <span className="truncate text-xs text-fg-muted">{item.name}</span>
                                </span>
                                <span className="w-24 shrink-0 text-right font-mono text-sm text-fg sm:w-28">
                                    {formatPriceTR(item.price)}
                                </span>
                                <span className="flex w-[5.25rem] shrink-0 justify-end sm:w-24">
                                    <ChangePill value={item.change_value} />
                                </span>
                            </Link>
                            {/* Masaüstünde yazılı, mobilde simgeli ekle düğmesi */}
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Plus />}
                                onClick={() => onQuickAdd(item)}
                                aria-label="Portföyüme ekle"
                                className="hidden md:inline-flex"
                            >
                                Ekle
                            </Button>
                            <IconButton
                                icon={<Plus />}
                                label="Portföyüme ekle"
                                size="sm"
                                className="md:hidden"
                                onClick={() => onQuickAdd(item)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}
