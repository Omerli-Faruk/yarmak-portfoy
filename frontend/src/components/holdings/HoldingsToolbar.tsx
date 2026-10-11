'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export type HoldingsSortType = 'custom' | 'val_desc' | 'pnl_desc' | 'pnl_asc' | 'name_asc' | 'amount_desc';

export const HOLDINGS_SORT_OPTIONS: { value: HoldingsSortType; label: string }[] = [
    { value: 'custom', label: 'Kendi sıram' },
    { value: 'val_desc', label: 'En yüksek değer' },
    { value: 'pnl_desc', label: 'En çok kazandıran' },
    { value: 'pnl_asc', label: 'En çok kaybettiren' },
    { value: 'name_asc', label: 'Alfabetik (A-Z)' },
    { value: 'amount_desc', label: 'En çok adet' },
];

interface HoldingsToolbarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    sortBy: HoldingsSortType;
    onSortChange: (sort: HoldingsSortType) => void;
    className?: string;
}

// Arama kutusu ve sıralama menüsü: tek satır, çerçevesiz. Masaüstünde grup sekmeleriyle aynı satırda durur.
export default function HoldingsToolbar({ searchQuery, onSearchChange, sortBy, onSortChange, className }: HoldingsToolbarProps) {
    return (
        <div className={cn('flex items-center gap-2 min-w-0', className)}>
            <Input
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Sembol veya ad ara"
                aria-label="Sembol veya varlık adı ara"
                leftIcon={<Search />}
                containerClassName="flex-1 lg:flex-none lg:w-60"
                rightSlot={
                    searchQuery ? (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            className="flex items-center justify-center size-11 sm:size-10 -mr-3 rounded text-fg-muted transition-colors duration-[120ms] hover:bg-surface-3 hover:text-fg cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            aria-label="Aramayı temizle"
                            title="Aramayı temizle"
                        >
                            <X className="size-[18px]" />
                        </button>
                    ) : undefined
                }
            />

            {/* Seçenek adları kendini anlattığı için "Sırala" etiketi yalnızca ekran okuyucuya */}
            <div className="w-[44%] shrink-0 sm:w-52">
                <label htmlFor="holdings-sort" className="sr-only">Sırala</label>
                <Select
                    id="holdings-sort"
                    value={sortBy}
                    onChange={e => onSortChange(e.target.value as HoldingsSortType)}
                    title="Sırala"
                >
                    {HOLDINGS_SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </Select>
            </div>
        </div>
    );
}
