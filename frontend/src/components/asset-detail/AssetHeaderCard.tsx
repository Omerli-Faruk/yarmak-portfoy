'use client';

import Link from 'next/link';
import { Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { ASSET_TYPE_LABELS, formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import { AssetDetailInfo, AssetFundamentals, formatIndexPoints, isIndexAsset } from './types';

interface AssetHeaderCardProps {
    assetData: AssetDetailInfo;
    rawSymbol: string;
    fundamentals: AssetFundamentals | null;
    summaryData: Record<string, number> | null;
    periodReturn: number | null;
    onRefreshStale: () => void;
}

// Günlük değişim için önce özet verisindeki 1G getirisine, sonra varlığın change alanına bakılır.
// change boş ya da sıfırsa grafikte seçili dönemin getirisi kullanılır; o da yoksa change olduğu gibi okunur.
function resolveDailyChange(
    summaryData: Record<string, number> | null,
    assetData: AssetDetailInfo,
    periodReturn: number | null
): number | null {
    if (summaryData && typeof summaryData['1D'] === 'number' && !isNaN(summaryData['1D'])) {
        return summaryData['1D'];
    }
    const change = assetData.change;
    const hasNonZeroChange = change !== undefined && change !== '' && change !== '0.00' && change !== '0';
    if (!hasNonZeroChange && periodReturn !== null && !isNaN(periodReturn)) {
        return periodReturn;
    }
    if (change === undefined) return null;
    const parsed = parseFloat(String(change).replace('+', ''));
    return isNaN(parsed) ? null : parsed;
}

export default function AssetHeaderCard({
    assetData,
    rawSymbol,
    fundamentals,
    summaryData,
    periodReturn,
    onRefreshStale,
}: AssetHeaderCardProps) {
    const isFund = assetData.asset_type === 'FON';
    const isGold = assetData.asset_type === 'ALTIN';
    const isIndex = isIndexAsset(rawSymbol, assetData.asset_type);
    const price = parseFloat(assetData.current_price ?? '');
    const dailyChange = resolveDailyChange(summaryData, assetData, periodReturn);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <div className="flex items-center space-x-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            {assetData.symbol || rawSymbol}
                            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider border border-slate-700/80">
                                {ASSET_TYPE_LABELS[assetData.asset_type ?? ''] ?? assetData.asset_type}
                            </span>
                        </h1>
                        <p className="text-slate-400 mt-1 md:text-lg">{assetData.name || 'Yükleniyor...'}</p>

                        {/* Son güncelleme ve gecikme bilgisi */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {fundamentals?.staleMessage && (
                                <button
                                    onClick={onRefreshStale}
                                    title="Verileri yenilemek için tıklayın"
                                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium border transition hover:opacity-80 active:scale-95 cursor-pointer ${
                                        fundamentals.isStale
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                    }`}
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{fundamentals.staleMessage}</span>
                                </button>
                            )}

                            {/* Fon fiyatları gün içinde değişmez, TEFAS'ta günlük yayımlanır */}
                            <Link
                                href="/disclaimer"
                                title={
                                    isFund
                                        ? "Fon fiyatları TEFAS'ta yayımlanan günlük fiyatlardır. Yatırım tavsiyesi değildir."
                                        : isGold
                                            ? 'Gram altın fiyatı serbest piyasa satış fiyatıdır, gösterge niteliğindedir. Yatırım tavsiyesi değildir.'
                                            : 'BIST verileri en az 15 dakika gecikmelidir. Yatırım tavsiyesi değildir.'
                                }
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700/60 transition"
                            >
                                <span>{isFund ? 'Günlük fiyat (TEFAS)' : isGold ? 'Serbest piyasa fiyatı' : '15 Dk. Gecikmeli'}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="md:text-right flex flex-col md:items-end">
                <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
                    {isNaN(price) ? '—' : isIndex ? formatIndexPoints(price) : formatPriceTR(price)}
                </p>

                {dailyChange !== null && (
                    <p
                        className={`flex items-center md:justify-end text-lg mt-1 font-medium ${dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        title="Bugünün Değişimi"
                    >
                        {dailyChange >= 0 ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                        {formatSignedPercent(dailyChange)}
                        <span className="text-xs text-slate-400 ml-2 font-normal">(Günlük)</span>
                    </p>
                )}
            </div>
        </div>
    );
}
