'use client';

import React from 'react';
import { NormalizedTransaction } from '@/types';
import { formatDate } from '@/lib/formatters';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface DeleteTransactionModalProps {
    tx: NormalizedTransaction;
    fmt: (value: number, showPlus?: boolean) => string;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteTransactionModal({
    tx,
    fmt,
    submitting,
    error,
    onCancel,
    onConfirm,
}: DeleteTransactionModalProps) {
    const isBuy = tx.type === 'BUY';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-rose-400">
                    <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                        <AlertTriangle className="size-6 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">İşlemi Sil</h3>
                        <p className="text-xs text-slate-400">Bu işlem geri alınamaz.</p>
                    </div>
                </div>

                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Varlık:</span>
                        <span className="font-bold text-white">
                            {tx.symbol} ({tx.assetName})
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">İşlem Türü:</span>
                        <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isBuy ? 'ALIŞ' : 'SATIŞ'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Miktar:</span>
                        <span className="text-white">
                            {tx.amount.toLocaleString('tr-TR')} Adet
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Birim Fiyat:</span>
                        <span className="text-white">
                            {fmt(tx.price)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Tarih:</span>
                        <span className="text-white">
                            {formatDate(tx.date)}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                    >
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        {submitting ? (
                            <>
                                <RefreshCw className="size-3.5 animate-spin" />
                                <span>Siliniyor...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="size-3.5" />
                                <span>İşlemi Kesin Olarak Sil</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
