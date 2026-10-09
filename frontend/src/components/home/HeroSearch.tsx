'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Search, TrendingUp, TrendingDown, ArrowRight, X } from 'lucide-react';
import { popularTags, type CatalogAsset } from '@/data/homeData';
import { formatPriceTR, formatSignedPercent, ASSET_TYPE_LABELS } from '@/lib/formatters';
import { scoreAssetMatch } from '@/lib/searchUtils';

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

// Ana sayfadaki arama kutusu, öneri listesi ve popüler etiketler
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
        <div className="w-full max-w-xl mt-9 relative z-50" ref={searchRef}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim() !== '') {
                        router.push(`/assets/${searchQuery.trim().toUpperCase()}`);
                    }
                }}
                className={`flex items-center gap-3 bg-[#131924] border ${
                    isSearchFocused ? 'border-primary' : 'border-border/80 hover:border-slate-600'
                } rounded-full px-5 py-3.5 transition-colors duration-200`}
            >
                <Search
                    className={`size-5 shrink-0 transition-colors ${
                        isSearchFocused ? 'text-primary' : 'text-slate-400'
                    }`}
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
                    className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    autoComplete="off"
                    spellCheck={false}
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                        aria-label="Temizle"
                    >
                        <X className="size-4" />
                    </button>
                )}
                <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2 rounded-full transition shrink-0 hidden sm:flex items-center gap-1.5 cursor-pointer"
                >
                    Keşfet <ArrowRight className="size-3.5" />
                </button>
            </form>

            {/* Öneri listesi */}
            <AnimatePresence>
                {isSearchFocused && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.99 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#111722] border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-[70] text-left divide-y divide-border/30"
                    >
                        <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-surface/40 flex items-center justify-between">
                            <span>{searchQuery ? `Sonuçlar (${searchResults.length})` : 'Öne Çıkan Varlıklar'}</span>
                            <span className="text-[9px] text-slate-500 font-mono">BIST 15 dk gecikmeli</span>
                        </div>

                        {searchResults.length > 0 ? (
                            <div className="max-h-80 overflow-y-auto divide-y divide-border/20">
                                {searchResults.map((asset) => {
                                    const num = parseFloat(asset.change || '0');
                                    const isZero = isNaN(num) || Math.abs(num) < 0.005;
                                    const isPos = num > 0;
                                    return (
                                        <div
                                            key={asset.symbol}
                                            onClick={() => {
                                                setSearchQuery(asset.symbol);
                                                setIsSearchFocused(false);
                                                router.push(`/assets/${asset.symbol}`);
                                            }}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-primary/10 transition-colors group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-xl bg-[#1A2230] border border-border/60 flex items-center justify-center font-bold text-xs text-primary group-hover:border-primary/50 transition-colors">
                                                    {asset.symbol.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                                            {asset.symbol}
                                                        </span>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border/50 text-slate-400 font-semibold">
                                                            {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px] sm:max-w-xs">
                                                        {asset.name}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-sm font-bold font-mono text-white">
                                                    {formatAssetPrice(asset)}
                                                </div>
                                                <div
                                                    className={`text-[11px] font-mono flex items-center justify-end gap-0.5 ${
                                                        isZero
                                                            ? 'text-slate-400'
                                                            : isPos
                                                            ? 'text-emerald-400'
                                                            : 'text-rose-400'
                                                    }`}
                                                >
                                                    {!isZero && (
                                                        isPos ? (
                                                            <TrendingUp className="size-3" />
                                                        ) : (
                                                            <TrendingDown className="size-3" />
                                                        )
                                                    )}
                                                    <span>{formatSignedPercent(isZero ? 0 : num)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-sm text-slate-400">
                                &quot;{searchQuery}&quot; için piyasada hisse veya fon bulunamadı.
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Popüler etiketler */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-xs">
                <span className="text-slate-500 font-medium">Popüler:</span>
                {popularTags.map((item) => (
                    <button
                        type="button"
                        key={item.query}
                        onClick={() => {
                            setSearchQuery(item.query);
                            setIsSearchFocused(true);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#131924]/60 border border-border/70 hover:border-primary/60 hover:bg-primary/10 text-slate-200 font-semibold text-xs transition shadow-sm cursor-pointer"
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
