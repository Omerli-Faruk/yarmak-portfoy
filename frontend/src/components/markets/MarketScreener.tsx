'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Plus, Search, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ChangePill from '@/components/ui/ChangePill';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import Input from '@/components/ui/Input';
import Section from '@/components/ui/Section';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ASSET_TYPE_LABELS, formatPriceTR } from '@/lib/formatters';
import type { MarketAssetItem } from '@/types';

export type MarketCategory = 'ALL' | 'HISSE' | 'FON' | 'EMTIA';
export type MarketSort = 'gainers' | 'losers' | 'popular' | 'alpha';

const CATEGORY_OPTIONS: { value: MarketCategory; label: string }[] = [
    { value: 'ALL', label: 'Tümü' },
    { value: 'HISSE', label: 'BIST hisseleri' },
    { value: 'FON', label: 'TEFAS fonları' },
    { value: 'EMTIA', label: 'Altın ve döviz' },
];

// "Seçili hisseler önce" API'deki sabit BIST seçkisini başa alır; sayfadaki ayrı liste bu sıralamaya taşındı
const SORT_OPTIONS: { id: MarketSort; label: string }[] = [
    { id: 'gainers', label: 'En çok artanlar' },
    { id: 'losers', label: 'En çok düşenler' },
    { id: 'popular', label: 'Seçili hisseler önce' },
    { id: 'alpha', label: 'A-Z' },
];

// Masaüstünde başlık satırı ile veri satırları aynı sütun genişliklerini kullanır
const COL_SYMBOL = 'md:w-20 shrink-0';
const COL_TYPE = 'w-20 shrink-0';
const COL_PRICE = 'md:w-28 shrink-0 text-right';
const COL_CHANGE = 'md:w-28 shrink-0 flex justify-end';
const COL_ACTIONS = 'md:w-24 shrink-0 flex items-center justify-end';

interface MarketScreenerProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    category: MarketCategory;
    onCategoryChange: (category: MarketCategory) => void;
    sort: MarketSort;
    onSortChange: (sort: MarketSort) => void;
    debouncedSearch: string;
    totalFound: number | null;
    loading: boolean;
    items: MarketAssetItem[];
    onQuickAdd: (item: MarketAssetItem) => void;
}

// Filtre durumu sayfada tutulur; bu bileşen yalnızca tabloyu ve kontrolleri çizer
export default function MarketScreener({
    searchQuery,
    onSearchChange,
    category,
    onCategoryChange,
    sort,
    onSortChange,
    debouncedSearch,
    totalFound,
    loading,
    items,
    onQuickAdd,
}: MarketScreenerProps) {
    return (
        <Section title="Varlık keşfi">
            {/* Tek filtre satırı: solda kategori sekmeleri, sağda arama ve sıralama.
                Mobilde sekmeler alta iner ki alt çizgileri satırın ayracına otursun. */}
            <div className="flex flex-col-reverse gap-2 border-b border-border lg:flex-row lg:items-end lg:justify-between lg:gap-4">
                <SegmentedControl
                    variant="underline"
                    options={CATEGORY_OPTIONS}
                    value={category}
                    onChange={onCategoryChange}
                    size="sm"
                    ariaLabel="Kategori"
                    className="-mb-px"
                />
                {/* Mobilde arama ve sıralama alt alta, tam genişlikte; geniş ekranda yan yana */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:pb-2">
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Hisse, fon veya sembol ara..."
                        aria-label="Hisse, fon veya sembol ara"
                        leftIcon={<Search />}
                        rightSlot={searchQuery ? (
                            <button
                                type="button"
                                aria-label="Aramayı temizle"
                                title="Aramayı temizle"
                                onClick={() => onSearchChange('')}
                                className="-mr-2 flex size-10 cursor-pointer items-center justify-center rounded text-fg-muted transition-colors duration-[120ms] hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-[18px]"
                            >
                                <X />
                            </button>
                        ) : undefined}
                        containerClassName="min-w-0 sm:flex-1 lg:w-72 lg:flex-none"
                    />
                    <label htmlFor="market-sort" className="hidden shrink-0 text-sm text-fg-muted lg:inline">
                        Sırala:
                    </label>
                    {/* Select kabı w-full taşır; genişliği sarmalayıcı belirler */}
                    <div className="w-full shrink-0 sm:w-56">
                        <Select
                            id="market-sort"
                            aria-label="Sırala"
                            value={sort}
                            onChange={e => onSortChange(e.target.value as MarketSort)}
                        >
                            {SORT_OPTIONS.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </Select>
                    </div>
                </div>
            </div>

            {/* Arama sonucu sayısı */}
            {debouncedSearch && totalFound !== null && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 text-sm">
                    <span className="min-w-0 break-words text-fg-muted">
                        <strong className="font-medium text-fg">&quot;{debouncedSearch}&quot;</strong> için <strong className="font-mono font-medium text-fg">{totalFound}</strong> varlık bulundu
                    </span>
                    <span className="text-xs text-fg-muted">
                        En alakalılar üstte, benzer varlıklar aşağıda listelenir
                    </span>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col divide-y divide-border">
                    <span className="sr-only">Piyasa varlıkları yükleniyor...</span>
                    {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="flex h-12 items-center gap-4">
                            <Skeleton className="h-3.5 w-14" />
                            <Skeleton className="h-3 w-40 max-w-full" />
                            <span className="flex-1" />
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="hidden h-3.5 w-16 md:block" />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    icon={<Activity />}
                    title={debouncedSearch ? `"${debouncedSearch}" aramasına uygun veya benzer varlık bulunamadı.` : 'Aramanıza uygun varlık bulunamadı.'}
                    description="Farklı bir sembol veya arama terimi deneyebilirsiniz."
                    action={searchQuery ? (
                        <Button size="sm" variant="secondary" leftIcon={<X />} onClick={() => onSearchChange('')}>
                            Aramayı temizle
                        </Button>
                    ) : undefined}
                />
            ) : (
                <div className="flex flex-col">
                    {/* Masaüstü sütun başlıkları; mobilde iki satırlı yığın satırlar kendi içinde anlaşılır */}
                    <div
                        aria-hidden
                        className="sticky top-0 z-10 hidden h-9 items-center gap-6 border-b border-border bg-bg text-xs text-fg-muted md:flex"
                    >
                        <span className="min-w-0 flex-1">Varlık</span>
                        <span className={cn(COL_TYPE, 'hidden lg:block')}>Tür</span>
                        <span className={COL_PRICE}>Fiyat</span>
                        <span className={COL_CHANGE}>Günlük değişim</span>
                        <span className={cn(COL_ACTIONS, 'pr-3.5')}>İşlem</span>
                    </div>

                    <ul className="flex flex-col divide-y divide-border">
                        {items.map((item, idx) => {
                            const typeLabel = ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type;
                            return (
                                <li
                                    key={`scr-${item.id}-${item.symbol}-${idx}`}
                                    className="flex min-h-14 items-center gap-2 py-1.5 transition-colors duration-[120ms] hover:bg-surface-2 md:h-12 md:min-h-0 md:gap-6 md:py-0"
                                >
                                    {/* Mobilde: üstte sembol + tür, altta ad. Masaüstünde tek satır. */}
                                    <Link
                                        href={`/assets/${item.symbol}`}
                                        className={cn(
                                            'group flex min-w-0 flex-1 flex-col justify-center self-stretch rounded md:flex-row md:items-center md:justify-start md:gap-6',
                                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                        )}
                                    >
                                        <span className={cn(COL_SYMBOL, 'flex min-w-0 items-center gap-1.5')}>
                                            <span className="truncate font-mono text-sm font-medium text-fg transition-colors duration-[120ms] group-hover:text-primary">
                                                {item.symbol}
                                            </span>
                                            {/* Tür etiketi mobilde sembolün yanında, geniş ekranda kendi sütununda */}
                                            <span className="flex lg:hidden">
                                                <Badge>{typeLabel}</Badge>
                                            </span>
                                        </span>
                                        <span className="min-w-0 truncate text-xs text-fg-muted md:text-sm">
                                            {item.name}
                                        </span>
                                    </Link>

                                    <span className={cn(COL_TYPE, 'hidden text-sm text-fg-muted lg:block')}>
                                        {typeLabel}
                                    </span>

                                    {/* Mobilde fiyat ve değişim alt alta, masaüstünde yan yana sütunlar */}
                                    <div className="flex shrink-0 flex-col items-end md:flex-row md:items-center md:gap-6">
                                        <span className={cn(COL_PRICE, 'font-mono text-sm text-fg')}>
                                            {formatPriceTR(item.price)}
                                        </span>
                                        <span className={COL_CHANGE}>
                                            <ChangePill value={item.change_value} />
                                        </span>
                                    </div>

                                    <div className={COL_ACTIONS}>
                                        {/* Satırdaki varlık bağlantısı detaya götürür; masaüstünde yazılı, mobilde simgeli ekle düğmesi */}
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
                                        <span className="flex md:hidden">
                                            <IconButton
                                                icon={<Plus />}
                                                label="Portföyüme ekle"
                                                size="sm"
                                                onClick={() => onQuickAdd(item)}
                                            />
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </Section>
    );
}
