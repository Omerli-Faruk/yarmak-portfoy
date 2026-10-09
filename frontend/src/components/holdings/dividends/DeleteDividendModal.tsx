'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteDividendModalProps {
    symbol: string;
    netAmount: number;
    fmt: (value: number, showPlus?: boolean) => string;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteDividendModal({
    symbol,
    netAmount,
    fmt,
    submitting,
    error,
    onCancel,
    onConfirm,
}: DeleteDividendModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                        <AlertTriangle className="w-5 h-5" />
                        <span>Temettü Kaydını Sil</span>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-white transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <strong className="text-white font-mono">{symbol}</strong> hissesine ait{' '}
                    <strong className="text-emerald-400 font-mono">
                        {fmt(netAmount)}
                    </strong> tutarındaki temettü kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>

                {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                    >
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-md shadow-rose-500/20"
                    >
                        {submitting ? 'Siliniyor...' : 'Evet, Sil'}
                    </button>
                </div>
            </div>
        </div>
    );
}
