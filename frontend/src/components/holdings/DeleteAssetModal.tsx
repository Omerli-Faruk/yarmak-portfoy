'use client';

import React from 'react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { UserHolding } from '@/types';

interface DeleteAssetModalProps {
    isOpen: boolean;
    asset: UserHolding | null;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
    fmt: (val: number) => string;
}

export default function DeleteAssetModal({
    isOpen,
    asset,
    isSubmitting,
    onClose,
    onConfirm,
    fmt,
}: DeleteAssetModalProps) {
    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0 border border-rose-500/30">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Varlığı Portföyden Sil</h3>
                        <p className="text-xs text-rose-400/90 font-medium">Bu işlem geri alınamaz</p>
                    </div>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                    <p className="text-xs text-slate-400">Silinecek Varlık:</p>
                    <p className="text-base font-black text-white font-mono">
                        {asset.symbol} <span className="text-xs font-normal text-slate-400 font-sans">({asset.asset_name})</span>
                    </p>
                    <p className="text-xs text-slate-300">
                        Mevcut Adet: <strong className="text-white">{asset.total_amount.toLocaleString('tr-TR')}</strong> • Toplam Değer: <strong className="text-white">{fmt(asset.total_value)}</strong>
                    </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                    Bu hisseye ait sistemde kayıtlı <strong className="text-white">tüm geçmiş alım-satım işlemleri</strong> silinecektir ve varlık portföyünüzden tamamen kaldırılacaktır.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Siliniyor...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Evet, Portföyden Sil</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
