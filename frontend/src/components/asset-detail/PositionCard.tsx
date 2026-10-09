'use client';

import { TrendingUp } from 'lucide-react';
import { formatSignedPercent, formatTRY } from '@/lib/formatters';

interface PositionCardProps {
    totalLots: number;
    avgCost: number;
    totalValue: number;
    profitLoss: number;
    profitLossPercent: number;
    canAdd: boolean;
    onAddTx: () => void;
}

// Kullanıcının bu varlıktaki pozisyonu: lot, ortalama maliyet, güncel değer ve kâr/zarar
export default function PositionCard({
    totalLots,
    avgCost,
    totalValue,
    profitLoss,
    profitLossPercent,
    canAdd,
    onAddTx,
}: PositionCardProps) {
    const isProfit = profitLoss >= 0;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shrink-0">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                Pozisyonum & Kâr / Zarar
            </h3>
            {totalLots > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <p className="text-slate-400 text-xs mb-1">Mevcut Lot</p>
                        <p className="text-lg font-bold text-white">{totalLots.toLocaleString('tr-TR')}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs mb-1">Maliyet (AOF)</p>
                        <p className="text-lg font-bold text-white">{formatTRY(avgCost, 3)}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs mb-1">Toplam Değer</p>
                        <p className="text-lg font-bold text-white">{formatTRY(totalValue)}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs mb-1">Güncel Kâr / Zarar</p>
                        <p className={`text-lg font-bold flex items-center ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatTRY(profitLoss, 2, true)}
                            <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-black/20">
                                {formatSignedPercent(profitLossPercent)}
                            </span>
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between py-1 text-slate-500 text-sm">
                    <span>Bu varlıktan portföyünüzde henüz lot bulunmuyor.</span>
                    {canAdd && (
                        <button
                            onClick={onAddTx}
                            className="text-xs font-semibold text-[#1A9FD3] hover:text-[#1589B7] transition underline cursor-pointer"
                        >
                            İşlem Ekle
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
