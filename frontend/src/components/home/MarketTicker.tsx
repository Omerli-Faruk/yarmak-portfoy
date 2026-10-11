'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { CatalogAsset } from '@/data/homeData';
import ChangePill from '@/components/ui/ChangePill';
import Skeleton from '@/components/ui/Skeleton';
import { buildMarketItems, type MarketItem } from './marketItems';

function TickerEntry({ item }: { item: MarketItem }) {
    return (
        <div className="flex shrink-0 cursor-default items-baseline gap-2 whitespace-nowrap">
            <span className="text-sm text-fg-muted">{item.label}</span>
            <span className="font-mono text-sm text-fg">{item.price}</span>
            <ChangePill value={item.change} />
        </div>
    );
}

// Kayan fiyat şeridi. Fiyatlar /api/assets'ten gelir; şeritteki varlıklar SLIDER_CONFIG sırasıyla gösterilir.
// Şerit her durumda kayar (hareket azaltma tercihine bakılmaz). Kutu yok, üstte ve altta ince çizgi.
export default function MarketTicker({ assets }: { assets: CatalogAsset[] }) {
    const items = useMemo(() => buildMarketItems(assets), [assets]);

    return (
        <section
            aria-label="Piyasa fiyatları"
            className="flex h-11 w-full shrink-0 items-center overflow-hidden border-y border-border"
        >
            {items.length === 0 ? (
                <div role="status" className="flex items-center gap-3">
                    <Skeleton className="h-3.5 w-14" />
                    <span className="text-sm text-fg-muted">Piyasa verileri yükleniyor...</span>
                    <Skeleton className="h-3.5 w-14" />
                </div>
            ) : (
                <div className="flex w-full select-none overflow-hidden">
                    <motion.div
                        className="flex shrink-0 items-center gap-10 pr-10"
                        animate={{ x: ['0%', '-50%'] }}
                        transition={{
                            repeat: Infinity,
                            repeatType: 'loop',
                            duration: 40,
                            ease: 'linear',
                        }}
                    >
                        {/* Liste iki kez art arda basılır, böylece kayma kesintisiz görünür */}
                        {[...items, ...items].map((item, idx) => (
                            <TickerEntry key={`${item.symbol}-${idx}`} item={item} />
                        ))}
                    </motion.div>
                </div>
            )}
        </section>
    );
}
