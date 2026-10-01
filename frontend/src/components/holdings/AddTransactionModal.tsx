'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import TransactionDatePicker from '@/components/TransactionDatePicker';

interface AddTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
    initialSymbol?: string;
    initialPrice?: string;
    initialType?: 'BUY' | 'SELL';
    maxLots?: number;
}

export default function AddTransactionModal({
    isOpen,
    onClose,
    onSuccess,
    initialSymbol = '',
    initialPrice = '',
    initialType = 'BUY',
    maxLots,
}: AddTransactionModalProps) {
    const [txSymbol, setTxSymbol] = useState(initialSymbol);
    const [txType, setTxType] = useState<'BUY' | 'SELL'>(initialType);
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState(initialPrice);
    const [txCommission, setTxCommission] = useState('0');
    const [txDate, setTxDate] = useState(() => new Date().toISOString());
    const [isTxDateError, setIsTxDateError] = useState(false);
    const [txSubmitting, setTxSubmitting] = useState(false);

    const [prevProps, setPrevProps] = useState({ isOpen, initialSymbol, initialPrice, initialType, maxLots });
    if (
        prevProps.isOpen !== isOpen ||
        prevProps.initialSymbol !== initialSymbol ||
        prevProps.initialPrice !== initialPrice ||
        prevProps.initialType !== initialType ||
        prevProps.maxLots !== maxLots
    ) {
        setPrevProps({ isOpen, initialSymbol, initialPrice, initialType, maxLots });
        if (isOpen) {
            setTxSymbol(initialSymbol);
            setTxPrice(initialPrice);
            setTxAmount('');
            setTxCommission('0');
            setTxDate(new Date().toISOString());
            setTxType(initialType);
        }
    }

    const isExceedingMax = txType === 'SELL' && maxLots !== undefined && parseFloat(txAmount) > maxLots;

    if (!isOpen) return null;

    const handleAddTx = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!txSymbol || !txAmount || !txPrice) return;
        if (new Date(txDate).getTime() > Date.now() + 60000) {
            alert('Gelecek tarihli işlem kaydedilemez.');
            return;
        }
        try {
            setTxSubmitting(true);
            await api.post('/transactions', {
                symbol: txSymbol.toUpperCase(),
                asset_type: 'HISSE',
                type: txType,
                amount: txAmount,
                price: txPrice,
                commission: txCommission || '0',
                transaction_date: txDate || new Date().toISOString(),
            });
            onClose();
            await onSuccess();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            alert(error.response?.data?.error || 'İşlem eklenirken hata oluştu');
        } finally {
            setTxSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white">İşlem Ekle</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleAddTx} className="space-y-3.5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Sembol</label>
                        <input
                            type="text"
                            required
                            value={txSymbol}
                            onChange={e => setTxSymbol(e.target.value.toUpperCase())}
                            placeholder="örn. ASELS, THYAO"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white uppercase font-bold focus:outline-none focus:border-[#1A9FD3]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setTxType('BUY')}
                            className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                                txType === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                        >
                            Alış (BUY)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTxType('SELL')}
                            className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                                txType === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                        >
                            Satış (SELL)
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-slate-300">Adet (Lot)</label>
                                {txType === 'SELL' && maxLots !== undefined && maxLots > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setTxAmount(String(maxLots))}
                                        className="text-[11px] font-bold text-[#1A9FD3] hover:text-white bg-[#1A9FD3]/15 hover:bg-[#1A9FD3] px-1.5 py-0.5 rounded transition cursor-pointer"
                                        title="Eldeki tüm lotları otomatik doldur"
                                    >
                                        Tümü: {maxLots.toLocaleString('tr-TR')}
                                    </button>
                                )}
                            </div>
                            <input
                                type="number"
                                step="any"
                                min="0.000001"
                                required
                                value={txAmount}
                                onChange={e => setTxAmount(e.target.value)}
                                placeholder="100"
                                className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none ${
                                    isExceedingMax ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-[#1A9FD3]'
                                }`}
                            />
                            {isExceedingMax && (
                                <p className="text-[11px] text-rose-400 mt-1 font-medium leading-tight">
                                    Mevcut {maxLots} lottan fazlasını satamazsınız.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Birim Fiyat (TL)</label>
                            <input
                                type="number"
                                step="any"
                                min="0.000001"
                                required
                                value={txPrice}
                                onChange={e => setTxPrice(e.target.value)}
                                placeholder="350.50"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3]"
                            />
                        </div>
                    </div>

                    {/* Tarih ve Saat Seçici */}
                    <TransactionDatePicker value={txDate} onChange={setTxDate} onErrorChange={setIsTxDateError} />

                    {/* Komisyon */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Ödenen Komisyon (₺) - Opsiyonel</label>
                        <input
                            type="number"
                            step="any"
                            min="0"
                            value={txCommission}
                            onChange={e => setTxCommission(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Komisyon girilirse alış maliyetine eklenir, kâr/zarar hesabını etkiler.</p>
                    </div>

                    {/* Toplam İşlem Tutarı Özeti */}
                    {parseFloat(txAmount) > 0 && parseFloat(txPrice) > 0 && (
                        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5 text-xs sm:text-sm">
                            <div className="flex justify-between items-center text-slate-400">
                                <span>İşlem Tutarı:</span>
                                <span className="font-mono text-slate-200 font-medium">
                                    {((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                </span>
                            </div>
                            {parseFloat(txCommission) > 0 && (
                                <div className="flex justify-between items-center text-slate-300">
                                    <span>+ Komisyon:</span>
                                    <span className="font-mono font-medium">
                                        {parseFloat(txCommission).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                    </span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                                <span className="text-slate-300 font-medium">Toplam {txType === 'BUY' ? 'Maliyet' : 'Net Tutar'}:</span>
                                <span className="font-bold text-white font-mono text-sm sm:text-base">
                                    {(((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)) + (txType === 'BUY' ? (parseFloat(txCommission) || 0) : -(parseFloat(txCommission) || 0))).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={txSubmitting || isTxDateError || Boolean(isExceedingMax)}
                            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition disabled:opacity-50 cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
                        >
                            {txSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
