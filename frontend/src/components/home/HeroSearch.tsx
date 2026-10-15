'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, X } from 'lucide-react';
import { popularTags, type CatalogAsset } from '@/data/homeData';
import { formatPriceTR, ASSET_TYPE_LABELS } from '@/lib/formatters';
import { scoreAssetMatch } from '@/lib/searchUtils';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import ChangePill from '@/components/ui/ChangePill';

const FEATURED_SYMBOLS = ['ASELS', 'TUPRS', 'THYAO', 'ALTIN', 'XU100', 'USDTRY'];
const INDEX_SYMBOLS = ['XU100', 'XU030'];

// /api/assets aramasıyla aynı puanlama: eşleşme puanına, değişimi sıfır olmayan varlıklar için +2000 eklenir.
function scoreAsset(asset: CatalogAsset, query: string): number {
    const score = scoreAssetMatch(asset.symbol, asset.name, query);
    if (score === 0) return 0;
    const change = asset.change;
    const hasMovement = change && change !== '0.00' && change !== '+0.00' && change !== '-0.00';
    return hasMovement ? score + 2000 : score;
}

// Endeks puanı TL değildir, ₺ eklenmez
function formatAssetPrice(asset: CatalogAsset): string {
    const price = parseFloat(asset.current_price);
    if (isNaN(price)) return '—';
    if (asset.asset_type === 'ENDEKS' || INDEX_SYMBOLS.includes(asset.symbol)) {
        return price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return formatPriceTR(price);
}

// Ana sayfadaki komut çubuğu tarzı arama kutusu, öneri listesi ve popüler etiketler
export default function HeroSearch({ assets }: { assets: CatalogAsset[] }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [dynamicMatches, setDynamicMatches] = useState<CatalogAsset[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);

    // Yazılan metni sunucuda da ara; katalogda olmayan hisse ve fonlar da bulunur
    useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDynamicMatches([]);
            return;
        }
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/assets?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setDynamicMatches(data);
                    }
                }
            } catch {
                // Sunucu araması başarısız olursa yerel sonuçlar gösterilmeye devam eder
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Arama alanı dışına tıklanınca listeyi kapat
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim();

        if (!q) {
            return assets.filter((a) => FEATURED_SYMBOLS.includes(a.symbol)).slice(0, 6);
        }

        const scored = assets
            .map((a) => ({ asset: a, score: scoreAsset(a, q) }))
            .filter((item) => item.score > 0);

        // Sunucu sonuçları geldiyse önce onlar, ardından katalogdaki diğer eşleşmeler
        if (dynamicMatches.length > 0) {
            const dynamicSymbols = new Set(dynamicMatches.map((d) => d.symbol));
            const extraLocal = scored
                .filter((item) => !dynamicSymbols.has(item.asset.symbol))
                .sort((a, b) => b.score - a.score)
                .map((item) => item.asset);
            return [...dynamicMatches, ...extraLocal].slice(0, 8);
        }

        // Sunucu yanıtı gelene kadar yalnızca katalogda ara
        return scored
            .sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return a.asset.symbol.localeCompare(b.asset.symbol);
            })
            .map((item) => item.asset)
            .slice(0, 8);
    }, [searchQuery, assets, dynamicMatches]);

    return (
        <div className="relative z-30 flex w-full max-w-[600px] flex-col gap-3" ref={searchRef}>
            <form
                role="search"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim() !== '') {
                        router.push(`/assets/${searchQuery.trim().toUpperCase()}`);
                    }
                }}
                className="flex items-stretch gap-2"
            >
                {/* Arama kutusu; Keşfet düğmesi kutunun dışında, yanında durur */}
                <div
                    className={cn(
                        'flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded border bg-surface pl-3.5 pr-1',
                        'transition-colors duration-[120ms]',
                        isSearchFocused ? 'border-primary' : 'border-border-strong hover:border-fg-subtle',
                    )}
                >
                    <Search
                        aria-hidden
                        className={cn('size-4 shrink-0', isSearchFocused ? 'text-primary' : 'text-fg-subtle')}
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (!isSearchFocused) setIsSearchFocused(true);
                        }}
                        onFocus={() => setIsSearchFocused(true)}
                        placeholder="Hisse veya fon ara (örn: THYAO, ASELS, TI2)..."
                        aria-label="Hisse veya fon ara"
                        className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {searchQuery && (
                        <IconButton
                            icon={<X />}
                            label="Temizle"
                            size="sm"
                            onClick={() => setSearchQuery('')}
                        />
                    )}
                </div>
                <Button type="submit" size="md" className="h-12 px-4 sm:px-5" aria-label="Keşfet">
                    <span className="hidden sm:inline">Keşfet</span>
                    <ArrowRight aria-hidden />
                </Button>
            </form>

            {/* Öneri listesi */}
            {isSearchFocused && (
                <div className="absolute inset-x-0 top-[3.25rem] z-40 flex flex-col overflow-hidden rounded-md border border-border-strong bg-surface text-left">
                    {/* Gecikme notu ekranda bir kez, yandaki Piyasalar listesinde yazılır */}
                    <div className="flex h-9 items-center border-b border-border px-3 text-xs text-fg-muted">
                        {searchQuery ? `Sonuçlar (${searchResults.length})` : 'Öne çıkan varlıklar'}
                    </div>

                    {searchResults.length > 0 ? (
                        <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto custom-scrollbar">
                            {searchResults.map((asset) => {
                                const num = parseFloat(asset.change || '0');
                                const isZero = isNaN(num) || Math.abs(num) < 0.005;
                                return (
                                    <li key={asset.symbol}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery(asset.symbol);
                                                setIsSearchFocused(false);
                                                router.push(`/assets/${asset.symbol}`);
                                            }}
                                            className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                                        >
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="flex min-w-0 items-baseline gap-2">
                                                    <span className="truncate font-mono text-sm font-medium text-fg">
                                                        {asset.symbol}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-fg-muted">
                                                        {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                                                    </span>
                                                </span>
                                                <span className="truncate text-xs text-fg-muted">{asset.name}</span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end">
                                                <span className="font-mono text-sm text-fg">{formatAssetPrice(asset)}</span>
                                                <ChangePill value={isZero ? 0 : num} />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="px-3 py-4 text-sm text-fg">
                            &quot;{searchQuery}&quot; için piyasada hisse veya fon bulunamadı.
                        </p>
                    )}
                </div>
            )}

            {/* Popüler aramalar: kutusuz, altı çizili metin düğmeleri; dokunma yüksekliği 44/40px */}
            <div className="flex flex-wrap items-center gap-x-4">
                <span className="text-sm text-fg-muted">Popüler:</span>
                {popularTags.map((item) => (
                    <button
                        type="button"
                        key={item.query}
                        onClick={() => {
                            setSearchQuery(item.query);
                            setIsSearchFocused(true);
                        }}
                        className="inline-flex min-h-11 cursor-pointer items-center rounded text-sm text-fg underline decoration-border-strong underline-offset-4 transition-colors duration-[120ms] hover:text-primary hover:decoration-primary sm:min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
