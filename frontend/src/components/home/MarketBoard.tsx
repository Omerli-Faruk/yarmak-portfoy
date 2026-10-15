'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { CatalogAsset } from '@/data/homeData';
import { cn } from '@/lib/cn';
import Section from '@/components/ui/Section';
import ChangePill from '@/components/ui/ChangePill';
import Skeleton from '@/components/ui/Skeleton';
import { buildMarketItems } from './marketItems';
import { tableHeadRowClasses } from '@/components/ui/tableStyles';

// Tablo sütun genişlikleri; başlık ve satırlar aynı değerleri kullanır
// Fiyat en çok "12.345,67 ₺"; değişim sütunu "▼ −%10,00" sığacak genişlikte
const COL_PRICE = 'w-24 shrink-0 text-right';
const COL_CHANGE = 'w-24 shrink-0 text-right';

// Ana sayfadaki dar yan sütun: endeks, döviz ve altın için kısa, kutusuz fiyat listesi.
// Hisseler burada yok; onlar kayan şeritte akar.
export default function MarketBoard({ assets, className }: { assets: CatalogAsset[]; className?: string }) {
    const rows = useMemo(() => buildMarketItems(assets, (type) => type !== 'stock' && type !== 'tefas'), [assets]);

    return (
        <Section
            title="Piyasalar"
            size="sm"
            action={<span className="text-xs text-warning">BIST 15 dk gecikmeli</span>}
            className={className}
            contentClassName="gap-0"
        >
            <div className={tableHeadRowClasses('gap-3')}>
                <span className="min-w-0 flex-1">Varlık</span>
                <span className={COL_PRICE}>Son</span>
                <span className={COL_CHANGE}>Gün</span>
            </div>

            {rows.length === 0 ? (
                <div className="flex flex-col divide-y divide-border" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex h-12 items-center gap-3 px-3">
                            <Skeleton className="h-3.5 w-24" />
                            <span className="flex-1" />
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-3.5 w-14" />
                        </div>
                    ))}
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-border">
                    {rows.map((row) => (
                        <li key={row.symbol}>
                            <Link
                                href={`/assets/${row.symbol}`}
                                className="flex h-12 items-center gap-3 rounded px-3 transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            >
                                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                                    <span className="truncate text-sm text-fg">{row.label}</span>
                                    <span className="hidden font-mono text-xs text-fg-muted sm:inline">{row.symbol}</span>
                                </span>
                                <span className={cn(COL_PRICE, 'font-mono text-sm text-fg')}>{row.price}</span>
                                <span className={COL_CHANGE}>
                                    <ChangePill value={row.change} />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}
