'use client';

import React, { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SegmentedControl from '@/components/ui/SegmentedControl';

export type TxTypeFilter = 'ALL' | 'BUY' | 'SELL';

const TYPE_OPTIONS: { value: TxTypeFilter; label: string }[] = [
    { value: 'ALL', label: 'Tümü' },
    { value: 'BUY', label: 'Alışlar' },
    { value: 'SELL', label: 'Satışlar' },
];

const ASSET_TYPE_FILTERS = [
    { id: 'ALL', label: 'Tüm türler' },
    { id: 'HISSE', label: 'Hisse' },
    { id: 'FON', label: 'Fon' },
    { id: 'ALTIN', label: 'Altın' },
    { id: 'DOVIZ', label: 'Döviz' },
];

interface TxFilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    typeFilter: TxTypeFilter;
    onTypeFilterChange: (value: TxTypeFilter) => void;
    assetTypeFilter: string;
    onAssetTypeFilterChange: (value: string) => void;
    actions?: ReactNode; // satırın sağ ucunda (örn. yenile düğmesi)
}

// Tablonun üstündeki sade filtre satırı: arama, işlem tipi ve varlık türü. Kutu yok.
// Mobilde arama tek başına üstte, filtreler altında.
export default function TxFilterBar({
    searchQuery,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    assetTypeFilter,
    onAssetTypeFilterChange,
    actions,
}: TxFilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Sembol veya ad ara"
                aria-label="Sembol veya varlık ara"
                leftIcon={<Search />}
                rightSlot={
                    searchQuery ? (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            aria-label="Aramayı temizle"
                            title="Aramayı temizle"
                            className="flex items-center justify-center size-11 sm:size-10 -mr-3 rounded text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors duration-[120ms] cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        >
                            <X className="size-[18px]" />
                        </button>
                    ) : undefined
                }
                containerClassName="basis-full sm:basis-auto sm:w-64"
            />

            <SegmentedControl
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={onTypeFilterChange}
                size="sm"
                ariaLabel="İşlem türü"
            />
            <Select
                value={assetTypeFilter}
                onChange={(e) => onAssetTypeFilterChange(e.target.value)}
                aria-label="Varlık türü"
                containerClassName="w-auto flex-1 sm:flex-none sm:w-40"
            >
                {ASSET_TYPE_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.label}
                    </option>
                ))}
            </Select>

            {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
    );
}
