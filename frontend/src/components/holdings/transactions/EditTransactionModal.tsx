'use client';

import React, { useState } from 'react';
import { NormalizedTransaction, Transaction } from '@/types';
import api from '@/lib/api';
import { formatTRY } from '@/lib/formatters';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle2,
    Pencil,
    RefreshCw,
    X,
} from 'lucide-react';

interface EditTransactionModalProps {
    tx: NormalizedTransaction;
    onClose: () => void;
    // Kayıt başarılı olunca güncellenen alanlar listeye işlenmek üzere üst bileşene verilir
    onSaved: (txId: number, patch: Partial<Transaction>) => void;
}

// datetime-local alanı yerel saat bekler. toISOString UTC verdiği için tarih elle "YYYY-MM-DDTHH:mm" olarak kurulur.
function toLocalInputValue(value: string): string {
    const parsed = value ? new Date(value) : new Date();
    const d = isNaN(parsed.getTime()) ? new Date() : parsed;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditTransactionModal({ tx, onClose, onSaved }: EditTransactionModalProps) {
    // Bileşen her işlem için key ile yeniden kurulduğundan başlangıç değerleri doğrudan kayıttan alınır
    const [editType, setEditType] = useState<'BUY' | 'SELL'>(tx.type === 'SELL' ? 'SELL' : 'BUY');
    const [editAmount, setEditAmount] = useState(tx.amount ? String(tx.amount) : '');
    const [editPrice, setEditPrice] = useState(tx.price ? String(tx.price) : '');
    const [editDate, setEditDate] = useState(() => toLocalInputValue(tx.date));
    const [editCommission, setEditCommission] = useState(String(tx.commission));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tx.id) return;

        const amountNum = parseFloat(editAmount);
        const priceNum = parseFloat(editPrice);
        const commNum = parseFloat(editCommission) || 0;

        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Lütfen geçerli bir işlem adedi girin.');
            return;
        }
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Lütfen geçerli bir birim fiyat girin.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Alandaki değer yerel saattir; sunucuya UTC olarak gönderilir
            const isoDate = new Date(editDate).toISOString();
            const res = await api.put<Transaction>(`/transactions/${tx.id}`, {
                type: editType,
                amount: amountNum,
                price: priceNum,
                transaction_date: isoDate,
                commission: commNum,
            });

            onSaved(tx.id, {
                ...res.data,
                Type: editType,
                type: editType,
                Amount: String(amountNum),
                amount: String(amountNum),
                Price: String(priceNum),
                price: String(priceNum),
                TransactionDate: isoDate,
                transaction_date: isoDate,
                Commission: String(commNum),
                commission: String(commNum),
            });
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: string; message?: string } } };
            const msg = apiError.response?.data?.error || apiError.response?.data?.message || 'İşlem güncellenemedi. Lütfen değerleri kontrol edin.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">

                {/* Başlık */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                            <Pencil className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>İşlemi Düzenle</span>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                    {tx.symbol}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 truncate max-w-xs">
                                {tx.assetName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Alış / satış */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                            İşlem Türü
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setEditType('BUY')}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                    editType === 'BUY'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm shadow-emerald-500/10'
                                        : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                            >
                                <ArrowDownRight className="size-4" />
                                <span>ALIŞ</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditType('SELL')}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                    editType === 'SELL'
                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-sm shadow-rose-500/10'
                                        : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                            >
                                <ArrowUpRight className="size-4" />
                                <span>SATIŞ</span>
                            </button>
                        </div>
                    </div>

                    {/* Adet ve birim fiyat. Fiyat her zaman TL olarak kaydedilir. */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                Adet / Lot
                            </label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                placeholder="0"
                                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                Birim Fiyat (₺)
                            </label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                            />
                        </div>
                    </div>

                    {/* Girilen adet ve fiyata göre toplam */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                        <span className="text-slate-400">Toplam İşlem Tutarı:</span>
                        <span className="text-sm font-black font-mono text-white">
                            {formatTRY((parseFloat(editAmount) || 0) * (parseFloat(editPrice) || 0))}
                        </span>
                    </div>

                    {/* Komisyon ve tarih */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                Komisyon (₺)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={editCommission}
                                onChange={(e) => setEditCommission(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-primary transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                İşlem Tarihi & Saati
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-primary transition [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw className="size-3.5 animate-spin" />
                                    <span>Güncelleniyor...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="size-3.5" />
                                    <span>Değişiklikleri Kaydet</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
