'use client';

import React from 'react';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import type { MarketIndexItem } from '@/types';

// Endeks değerleri puan olarak yazılır, ₺ almaz
const INDEX_POINT_SYMBOLS = ['XU100', 'XU030'];

interface IndexStripProps {
    indices: MarketIndexItem[];
}

export default function IndexStrip({ indices }: IndexStripProps) {
    return (
        <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="size-3.5 text-[#1A9FD3]" />
                Endeksler ve Kurlar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {indices.map(idx => (
                    <div
                        key={idx.symbol}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition shadow-xs"
                    >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span className="font-bold text-slate-300 font-mono">{idx.symbol}</span>
                            <span className="truncate ml-2 text-[11px] text-slate-500">{idx.name}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                                {INDEX_POINT_SYMBOLS.includes(idx.symbol)
                                    ? idx.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
                                    : formatPriceTR(idx.price)}
                            </span>
                            <span
                                className={`text-xs font-bold font-mono flex items-center tabular-nums ${
                                    idx.positive ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                            >
                                {idx.positive ? (
                                    <TrendingUp className="size-3 mr-0.5" />
                                ) : (
                                    <TrendingDown className="size-3 mr-0.5" />
                                )}
                                {/* API değişimi "+1.25" gibi nokta ondalıklı ve % işaretsiz gönderir */}
                                {formatSignedPercent(parseFloat(idx.change) || 0)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
