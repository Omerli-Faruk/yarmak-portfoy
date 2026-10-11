'use client';

import React, { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';

interface DividendFilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedYear: string;
    onYearChange: (year: string) => void;
    availableYears: string[];
    actions?: ReactNode; // satırın sağ ucunda (yenile, temettü ekle)
}

// Tablonun üstündeki sade filtre satırı: arama, yıl seçimi ve sağda eylemler. Kutu yok.
export default function DividendFilterBar({
    searchQuery,
    onSearchChange,
    selectedYear,
    onYearChange,
    availableYears,
    actions,
}: DividendFilterBarProps) {
    const yearOptions = [
        { value: 'ALL', label: 'Tümü' },
        ...availableYears.map((yr) => ({ value: yr, label: yr })),
    ];

    return (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            {/* Arama */}
            <Input
                type="text"
                placeholder="Hisse kodu veya şirket ara"
                aria-label="Hisse kodu veya şirket ara"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
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
                containerClassName="sm:w-64 sm:shrink-0"
            />

            {/* Yıl seçimi; yıl çoksa yatay kayar */}
            <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-sm text-fg-muted">Yıl</span>
                <SegmentedControl
                    options={yearOptions}
                    value={selectedYear}
                    onChange={onYearChange}
                    size="sm"
                    mono
                    ariaLabel="Yıl"
                    className="min-w-0"
                />
            </div>

            {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
        </div>
    );
}
