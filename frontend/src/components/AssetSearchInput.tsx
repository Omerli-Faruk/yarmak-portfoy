'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ASSET_TYPE_LABELS, formatPriceTR } from '@/lib/formatters';
import Input from '@/components/ui/Input';

// Arama sonucundaki varlık; fiyat TL, bilinmiyorsa 0
export interface AssetSearchItem {
    id?: number;
    symbol: string;
    name: string;
    assetType?: string;
    price: number;
}

interface ApiAssetResponse {
    id?: number;
    symbol: string;
    name?: string;
    price?: string;
    current_price?: string;
    type?: string;
    asset_type?: string;
}

interface AssetSearchInputProps {
    id?: string;
    value: string;
    onChange: (value: string) => void; // yazılan metin, büyük harfe çevrilmiş
    onSelect: (asset: AssetSearchItem) => void;
    // false iken arama yapılmaz, liste açılmaz (ör. varlık zaten seçili)
    searchEnabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    required?: boolean;
    limit?: number;
    // Bu türler listede gösterilmez (ör. işlem eklerken endeksler)
    excludeTypes?: string[];
    emptyText?: string;
}

// Sonuçlar hangi sorguya ait; hata olursa boş liste ve error
type SearchResult = { query: string; items: AssetSearchItem[]; error?: boolean };

const DEBOUNCE_MS = 300;

// Varlık arama kutusu: yazılanı 300 ms bekleyip /api/assets'te arar, sonuçları altında listeler.
// Klavye: ↑/↓ gezinir, Enter seçer (satır seçili değilse form normal gönderilir), Esc listeyi kapatır.
export default function AssetSearchInput({
    id,
    value,
    onChange,
    onSelect,
    searchEnabled = true,
    placeholder = 'Sembol ya da ad yazın (örn. THYAO)',
    autoFocus,
    required,
    limit = 6,
    excludeTypes,
    emptyText = 'Eşleşen varlık bulunamadı',
}: AssetSearchInputProps) {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [focused, setFocused] = useState(false);
    // Esc ile kapatılan sorgu; yeni bir şey yazılınca liste yeniden açılır
    const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
    // Listeden seçilen sembol; kutuda o yazarken tekrar aranmaz
    const [picked, setPicked] = useState<string | null>(null);

    const query = value.trim();
    const shouldSearch = searchEnabled && query !== '' && query.toUpperCase() !== picked;
    const excludeKey = (excludeTypes ?? []).map(t => t.toUpperCase()).join(',');

    useEffect(() => {
        if (!shouldSearch) return;
        let cancelled = false;
        const excluded = excludeKey ? excludeKey.split(',') : [];

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/assets?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: unknown = await res.json();
                if (cancelled) return;
                const items: AssetSearchItem[] = (Array.isArray(data) ? (data as ApiAssetResponse[]) : [])
                    .map(item => ({
                        id: item.id,
                        symbol: item.symbol,
                        name: item.name || item.symbol,
                        price: parseFloat(item.current_price || item.price || '0') || 0,
                        assetType: item.asset_type || item.type,
                    }))
                    .filter(item => !item.assetType || !excluded.includes(item.assetType.toUpperCase()))
                    .slice(0, limit);
                setResult({ query, items });
                setActiveIndex(-1);
            } catch (err) {
                if (cancelled) return;
                console.error('Varlık arama hatası:', err);
                setResult({ query, items: [], error: true });
                setActiveIndex(-1);
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [shouldSearch, query, limit, excludeKey]);

    // Sonuç henüz bu sorguya ait değilse arama sürüyordur
    const isSearching = shouldSearch && result?.query !== query;
    // Yeni sonuç gelene kadar önceki sonuçlar görünür kalır (her tuşta liste kaybolup gelmesin);
    // önceki sonuç boşsa arama sürerken "bulunamadı" yazmaz
    const items = shouldSearch && result ? result.items : [];
    const showList = shouldSearch && focused && result !== null && dismissedQuery !== query
        && !(isSearching && items.length === 0);
    const activeItem = showList && activeIndex >= 0 ? items[activeIndex] : undefined;

    // autoFocus elle ve bir sonraki turda: Modal açılış odağını ve kapanınca geri vereceği odağı bozmasın
    useEffect(() => {
        if (!autoFocus) return;
        const timer = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [autoFocus]);

    // Klavyeyle seçilen satır görünür alanda kalsın
    useEffect(() => {
        if (activeIndex < 0) return;
        document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, listId]);

    const pick = (asset: AssetSearchItem) => {
        setPicked(asset.symbol.toUpperCase());
        setActiveIndex(-1);
        onSelect(asset);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            if (!showList) return;
            // Modal da Esc'i document'ta dinliyor; React'in dinleyicisi de document'ta olabildiği için
            // stopImmediatePropagation gerekiyor. Yalnızca liste kapansın, modal açık kalsın.
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setDismissedQuery(query);
            setActiveIndex(-1);
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Esc ile kapatılan liste okla yeniden açılır
            if (dismissedQuery === query) {
                e.preventDefault();
                setDismissedQuery(null);
                return;
            }
            if (!showList || items.length === 0) return;
            e.preventDefault();
            const down = e.key === 'ArrowDown';
            const n = items.length;
            setActiveIndex(i => (down ? (i >= n - 1 ? 0 : i + 1) : (i <= 0 ? n - 1 : i - 1)));
            return;
        }
        // Satır seçiliyse Enter onu seçer; değilse form her zamanki gibi gönderilir
        if (e.key === 'Enter' && activeItem) {
            e.preventDefault();
            pick(activeItem);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <Input
                ref={inputRef}
                id={id}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={activeItem ? `${listId}-opt-${activeIndex}` : undefined}
                value={value}
                onChange={(e) => {
                    setPicked(null);
                    setDismissedQuery(null);
                    setActiveIndex(-1);
                    onChange(e.target.value.toUpperCase());
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                autoComplete="off"
                required={required}
                className="font-mono font-medium placeholder:font-sans placeholder:font-normal"
                leftIcon={<Search />}
                rightSlot={
                    isSearching ? (
                        <LoaderCircle className="size-4 animate-spin text-fg-muted" aria-label="Aranıyor" />
                    ) : undefined
                }
            />

            {/* Ekran okuyucuya arama durumu */}
            <span className="sr-only" role="status" aria-live="polite">
                {isSearching ? 'Aranıyor' : showList ? (items.length > 0 ? `${items.length} sonuç` : emptyText) : ''}
            </span>

            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Arama sonuçları"
                    // Tıklarken odak kutuda kalsın, liste kapanmasın
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex flex-col max-h-60 overflow-y-auto custom-scrollbar rounded border border-border bg-surface divide-y divide-border"
                >
                    {items.length === 0 ? (
                        <li className="flex items-center min-h-11 px-3 py-2 text-sm text-fg-muted">
                            {result?.error ? 'Arama şu an yapılamıyor' : emptyText}
                        </li>
                    ) : (
                        items.map((item, i) => (
                            <li
                                key={`${item.symbol}-${item.assetType ?? ''}`}
                                id={`${listId}-opt-${i}`}
                                role="option"
                                aria-selected={i === activeIndex}
                                onClick={() => pick(item)}
                                onMouseMove={() => { if (i !== activeIndex) setActiveIndex(i); }}
                                className={cn(
                                    'flex items-center gap-3 min-h-12 py-1.5 px-3 cursor-pointer transition-colors duration-[120ms]',
                                    i === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2',
                                )}
                            >
                                <span className="flex flex-1 min-w-0 flex-col">
                                    <span className="font-mono text-sm font-medium text-fg">{item.symbol}</span>
                                    <span className="text-xs text-fg-muted truncate">{item.name}</span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end">
                                    <span className="font-mono text-sm text-fg whitespace-nowrap">
                                        {item.price > 0 ? formatPriceTR(item.price) : '—'}
                                    </span>
                                    {item.assetType && (
                                        <span className="text-xs text-fg-muted">
                                            {ASSET_TYPE_LABELS[item.assetType.toUpperCase()] ?? item.assetType}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
