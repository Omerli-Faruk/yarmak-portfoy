'use client';

import { Clock, History, X } from 'lucide-react';
import { formatDate, formatTRY } from '@/lib/formatters';
import type { NormalizedTransaction } from '@/types';

interface AssetTxHistoryProps {
    isLoggedIn: boolean;
    transactions: NormalizedTransaction[];
    onRegister: () => void;
    onAddTx: () => void;
    onDelete: (id: number) => void;
}

// Kullanıcının bu varlıktaki işlemleri. Misafire hesap açma çağrısı gösterilir.
export default function AssetTxHistory({ isLoggedIn, transactions, onRegister, onAddTx, onDelete }: AssetTxHistoryProps) {
    return (
        <div className="w-full lg:w-96 xl:w-1/3 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[32rem] lg:h-auto">
            <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4 shrink-0">
                <div className="flex items-center text-lg font-semibold text-white">
                    <History className="w-5 h-5 mr-2 text-[#1A9FD3]" />
                    İşlem Geçmişi
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {!isLoggedIn ? (
                    <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                        <History className="w-12 h-12 mb-3 opacity-20" />
                        <p>İşlem geçmişinizi görmek için ücretsiz hesap açın.</p>
                        <button onClick={onRegister} className="text-[#1A9FD3] hover:text-[#1589B7] hover:underline mt-3 text-sm transition font-medium cursor-pointer">Hesap Oluştur</button>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                        <Clock className="w-12 h-12 mb-3 opacity-20" />
                        <p>Henüz işlem geçmişi yok.</p>
                        <button onClick={onAddTx} className="text-[#1A9FD3] hover:text-[#1589B7] hover:underline mt-3 text-sm transition cursor-pointer">İlk işlemini ekle</button>
                    </div>
                ) : (
                    transactions.map((tx) => {
                        const isBuy = tx.type === 'BUY';
                        const subtotal = tx.amount * tx.price;
                        // Alışta komisyon tutara eklenir, satışta hesaba geçen tutardan düşülür
                        const totalWithComm = isBuy ? subtotal + tx.commission : subtotal - tx.commission;

                        return (
                            <div key={tx.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {isBuy ? 'ALIŞ' : 'SATIŞ'}
                                        </span>
                                        <span className="text-slate-400 text-xs ml-3">{formatDate(tx.date)}</span>
                                    </div>
                                    <button
                                        onClick={() => onDelete(tx.id)}
                                        className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 p-1 rounded"
                                        title="Sil"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-0.5">Fiyat</p>
                                        <p className="font-medium text-slate-200">{formatTRY(tx.price, 4)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-0.5">Adet / Lot</p>
                                        <p className="font-medium text-slate-200">{tx.amount.toLocaleString('tr-TR')}</p>
                                    </div>
                                </div>

                                {tx.commission > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-700/40 flex justify-between items-center text-xs">
                                        <span className="text-amber-400/90 flex items-center gap-1">
                                            <span>Komisyon:</span>
                                            <span className="font-medium font-mono">{isBuy ? '+' : '-'}{formatTRY(tx.commission)}</span>
                                        </span>
                                        <span className="text-slate-400">
                                            Toplam: <span className="font-medium text-slate-200 font-mono">{formatTRY(totalWithComm)}</span>
                                        </span>
                                    </div>
                                )}

                                {tx.type === 'SELL' && tx.realizedPnl !== 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                                        <p className="text-xs text-slate-400">Gerçekleşen Kâr/Zarar</p>
                                        <p className={`font-semibold text-sm ${tx.realizedPnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {formatTRY(tx.realizedPnl, 2, true)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
