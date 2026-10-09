'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { SLIDER_CONFIG, type CatalogAsset, type TickerType } from '@/data/homeData';
import { formatPriceTR, formatSignedPercent } from '@/lib/formatters';

// Şeritte varlık adının önündeki küçük etiket. Endekslerde etiket yok.
const TYPE_BADGES: Partial<Record<TickerType, string>> = {
    flag_us: 'USD',
    flag_eu: 'EUR',
    gold: 'ALTIN',
    tefas: 'FON',
    stock: 'BIST',
};

interface TickerItem {
    id: string;
    label: string;
    price: string;
    change: string;
    positive: boolean;
    badge?: string;
}

// Kayan fiyat şeridi. Fiyatlar /api/assets'ten gelir; şeritteki varlıklar SLIDER_CONFIG sırasıyla gösterilir.
export default function MarketTicker({ assets }: { assets: CatalogAsset[] }) {
    const items = useMemo(() => {
        const result: TickerItem[] = [];

        SLIDER_CONFIG.forEach((cfg) => {
            const asset = assets.find((a) => a.symbol === cfg.symbol);
            const price = asset ? parseFloat(asset.current_price) : NaN;
            if (!asset || !(price > 0)) return;

            const change = parseFloat(asset.change);
            result.push({
                id: cfg.symbol.toLowerCase(),
                label: cfg.label,
                // Endeks puanı TL değildir, ₺ eklenmez
                price: cfg.type === 'index'
                    ? price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : formatPriceTR(price),
                change: formatSignedPercent(isNaN(change) ? 0 : change),
                positive: asset.positive,
                badge: TYPE_BADGES[cfg.type],
            });
        });

        return result;
    }, [assets]);

    return (
        <section className="w-full border-y border-white/[0.08] bg-[#090D14] py-3.5 overflow-hidden flex items-center justify-center">
            {items.length > 0 ? (
                <div className="flex w-full overflow-hidden select-none">
                    <motion.div
                        className="flex shrink-0 items-center gap-8 sm:gap-12"
                        animate={{ x: ['0%', '-50%'] }}
                        transition={{
                            repeat: Infinity,
                            repeatType: 'loop',
                            duration: 32,
                            ease: 'linear',
                        }}
                    >
                        {/* Liste iki kez art arda basılır, böylece kayma kesintisiz görünür */}
                        {[...items, ...items].map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="flex items-center gap-2 shrink-0 group cursor-default">
                                {item.badge && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
                                        {item.badge}
                                    </span>
                                )}

                                <span className="text-slate-200 font-semibold tracking-wide text-xs sm:text-[13px]">
                                    {item.label}
                                </span>

                                <span
                                    className={`font-mono font-bold text-xs sm:text-[13px] ${
                                        item.positive ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {item.price}
                                </span>

                                <span
                                    className={`font-mono text-xs sm:text-[13px] ${
                                        item.positive ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {item.change}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            ) : (
                <div className="text-xs font-mono text-slate-400 py-1">
                    Piyasa verileri yükleniyor...
                </div>
            )}
        </section>
    );
}
