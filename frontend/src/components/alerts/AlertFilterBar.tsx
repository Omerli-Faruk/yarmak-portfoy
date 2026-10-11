'use client';

import { Search, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';

export type AlertFilter = 'ALL' | 'PENDING' | 'TRIGGERED';

interface AlertFilterBarProps {
    filterTab: AlertFilter;
    onFilterTab: (tab: AlertFilter) => void;
    searchQuery: string;
    onSearch: (query: string) => void;
}

// Sayılar sayfanın üstündeki büyük özetle aynı olduğu için sekmelerde tekrar yazılmaz
const FILTER_TABS: { value: AlertFilter; label: string }[] = [
    { value: 'ALL', label: 'Tümü' },
    { value: 'PENDING', label: 'Bekleyenler' },
    { value: 'TRIGGERED', label: 'Tetiklenenler' },
];

// Tablonun üstündeki tek satır: solda alt çizgili sekmeler, sağda arama. Kutu yok, yalnızca alt çizgi.
// Sekmelerin kendi alt çizgisi -mb-px ile satırın çizgisinin üstüne oturur, tek çizgi görünür.
export default function AlertFilterBar({ filterTab, onFilterTab, searchQuery, onSearch }: AlertFilterBarProps) {
    return (
        <div className="flex flex-col-reverse gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <SegmentedControl
                variant="underline"
                options={FILTER_TABS}
                value={filterTab}
                onChange={onFilterTab}
                ariaLabel="Alarm durumu"
                className="-mb-px"
            />

            <Input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Sembol veya varlık ara"
                aria-label="Sembol veya varlık ara"
                leftIcon={<Search />}
                containerClassName="w-full sm:w-72"
                rightSlot={
                    searchQuery ? (
                        <button
                            type="button"
                            onClick={() => onSearch('')}
                            aria-label="Aramayı temizle"
                            title="Aramayı temizle"
                            className="-mr-2 flex items-center justify-center size-10 rounded text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors duration-[120ms] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <X className="size-[18px]" />
                        </button>
                    ) : undefined
                }
            />
        </div>
    );
}
