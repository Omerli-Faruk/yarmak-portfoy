'use client';

import { Activity } from 'lucide-react';
import type { AssetFundamentals } from './types';

// Hisseler için Yahoo'dan gelen temel veriler. Değerler API'den biçimlenmiş metin olarak gelir.
export default function FundamentalsGrid({ fundamentals }: { fundamentals: AssetFundamentals }) {
    return (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                Temel Bilgiler & İstatistikler
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4">
                <div>
                    <p className="text-xs text-slate-500 mb-1">Piyasa Değeri</p>
                    <p className="font-semibold text-slate-200">{fundamentals.marketCap}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">F/K Oranı</p>
                    <p className="font-semibold text-slate-200">{fundamentals.peRatio}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">Temettü Verimi</p>
                    <p className="font-semibold text-slate-200">{fundamentals.dividendYield}</p>
                </div>
                {fundamentals.dividendRate !== '-' && (
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Hisse Başı Temettü</p>
                        <p className="font-semibold text-slate-200">{fundamentals.dividendRate}</p>
                    </div>
                )}
                {fundamentals.exDividendDate !== '-' && (
                    <div>
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                            <span>{fundamentals.exDividendLabel || (fundamentals.isExDateFuture === 'true' ? 'Açıklanan Temettü' : 'Son Temettü Tarihi')}</span>
                            {fundamentals.isExDateFuture === 'true' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Planlanan
                                </span>
                            )}
                        </p>
                        <p className="font-semibold text-slate-200">{fundamentals.exDividendDate}</p>
                    </div>
                )}
                <div>
                    <p className="text-xs text-slate-500 mb-1">Beta (Risk)</p>
                    <p className="font-semibold text-slate-200">{fundamentals.beta}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">52 Hafta Zirve</p>
                    <p className="font-semibold text-slate-200">{fundamentals.fiftyTwoWeekHigh}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">52 Hafta Dip</p>
                    <p className="font-semibold text-slate-200">{fundamentals.fiftyTwoWeekLow}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 mb-1">Hacim</p>
                    <p className="font-semibold text-slate-200">{fundamentals.volume}</p>
                </div>
            </div>
        </div>
    );
}
