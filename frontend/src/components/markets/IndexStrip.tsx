'use client';

import React from 'react';
import ChangePill from '@/components/ui/ChangePill';
import Hero, { HeroMeta } from '@/components/ui/Hero';
import Skeleton from '@/components/ui/Skeleton';
import SummaryStrip from '@/components/ui/SummaryStrip';
import { formatPriceTR } from '@/lib/formatters';
import type { MarketIndexItem } from '@/types';

// Endeks değerleri puan olarak yazılır, ₺ almaz
const INDEX_POINT_SYMBOLS = ['XU100', 'XU030'];

// Sayfanın odak noktası BIST 100; gelmezse listedeki ilk değer öne çıkar
const HERO_SYMBOL = 'XU100';

function formatIndexValue(idx: MarketIndexItem) {
    return INDEX_POINT_SYMBOLS.includes(idx.symbol)
        ? idx.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
        : formatPriceTR(idx.price);
}

// API değişimi "+1.25" gibi nokta ondalıklı ve % işaretsiz gönderir
function changeOf(idx: MarketIndexItem) {
    return parseFloat(idx.change) || 0;
}

interface IndexStripProps {
    indices: MarketIndexItem[];
    loading?: boolean;
}

// Üstte BIST 100 büyük sayı olarak, altında diğer endeks, kur ve altın değerleri tek şeritte
export default function IndexStrip({ indices, loading = false }: IndexStripProps) {
    if (loading && indices.length === 0) {
        return (
            <div role="region" aria-label="Endeksler ve kurlar" className="flex flex-col gap-6">
                <span className="sr-only">Yükleniyor...</span>
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-56" />
                    <Skeleton className="h-3.5 w-32" />
                </div>
                <div className="flex gap-4 border-y border-border py-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="flex flex-1 flex-col gap-1.5">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3.5 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const lead = indices.find(idx => idx.symbol === HERO_SYMBOL) ?? indices[0];
    const rest = indices.filter(idx => idx !== lead);

    return (
        <div role="region" aria-label="Endeksler ve kurlar" className="flex flex-col gap-6">
            <Hero
                label={lead?.name ?? 'BIST 100'}
                value={lead ? formatIndexValue(lead) : '—'}
                sub={lead && (
                    <HeroMeta label="Bugün">
                        <ChangePill value={changeOf(lead)} size="md" />
                    </HeroMeta>
                )}
            />
            {/* Değişim değerin altında durur ki 360px'te iki hücre yan yana sığsın */}
            <SummaryStrip
                ariaLabel="Diğer endeksler, kurlar ve altın"
                items={rest.map(idx => ({
                    label: idx.name,
                    title: idx.symbol,
                    value: formatIndexValue(idx),
                    hint: <ChangePill value={changeOf(idx)} />,
                }))}
            />
        </div>
    );
}
