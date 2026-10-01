'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { UserHolding, Dividend } from '@/types';

interface AddDividendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
    holdings: UserHolding[];
    initialDividend?: Dividend | null;
}

export default function AddDividendModal({
    isOpen,
    onClose,
    onSuccess,
    holdings,
    initialDividend = null,
}: AddDividendModalProps) {
    const isEditMode = !!initialDividend;

    // Yalnızca hisse senetleri temettü dağıtabilir (Fon, Döviz ve Altın hariç tutulur)
    const stockHoldings = useMemo(() => {
        return holdings.filter(h => h.asset_type === 'HISSE');
    }, [holdings]);

    const [selectedAssetId, setSelectedAssetId] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [calcMode, setCalcMode] = useState<'PER_SHARE' | 'TOTAL'>('TOTAL');
    const [amountValue, setAmountValue] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Modal açıldığında form doldur / sıfırla
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setErrorMsg(null);
            if (initialDividend) {
                // Düzenleme modu: Mevcut verileri doldur
                const assetId = Number(initialDividend.asset_id || initialDividend.AssetID || 0);
                setSelectedAssetId(assetId);

                const dateStr = initialDividend.payment_date || initialDividend.PaymentDate || '';
                if (dateStr) {
                    setPaymentDate(new Date(dateStr).toISOString().split('T')[0]);
                } else {
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                }

                const netVal = initialDividend.net_amount || initialDividend.NetAmount || initialDividend.amount || initialDividend.Amount || '';
                setAmountValue(netVal ? parseFloat(netVal).toString() : '');
                setCalcMode('TOTAL');
            } else {
                // Yeni ekleme modu
                if (stockHoldings.length > 0) {
                    setSelectedAssetId(stockHoldings[0].asset_id);
                } else {
                    setSelectedAssetId(0);
                }
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setAmountValue('');
                setCalcMode('TOTAL');
            }
        }
    }, [isOpen, initialDividend, stockHoldings]);

    // Seçili hisse
    const selectedHolding = useMemo(() => {
        return stockHoldings.find(h => h.asset_id === selectedAssetId) || null;
    }, [stockHoldings, selectedAssetId]);

    // Canlı net tutar hesaplama dökümü
    const preview = useMemo(() => {
        const val = parseFloat(amountValue);
        if (isNaN(val) || val <= 0) return null;

        const lots = selectedHolding?.total_amount || 0;
        let totalNet = 0;
        let perShareNet = 0;

        if (calcMode === 'PER_SHARE') {
            perShareNet = val;
            totalNet = lots > 0 ? val * lots : val;
        } else {
            totalNet = val;
            perShareNet = lots > 0 ? val / lots : 0;
        }

        return {
            totalNet,
            perShareNet,
            lots,
        };
    }, [amountValue, calcMode, selectedHolding]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAssetId) {
            setErrorMsg('Lütfen temettü aldığınız hisse senedini seçin.');
            return;
        }
        const val = parseFloat(amountValue);
        if (isNaN(val) || val <= 0) {
            setErrorMsg('Lütfen geçerli bir temettü tutarı girin.');
            return;
        }

        try {
            setSubmitting(true);
            setErrorMsg(null);

            // Bankadan/Midas'tan hesaba geçen net nakit doğrudan kaydedilir
            const payload: {
                asset_id: number;
                payment_date: string;
                tax_rate: string;
                is_net: boolean;
                amount?: string;
                amount_per_share?: string;
            } = {
                asset_id: selectedAssetId,
                payment_date: new Date(paymentDate).toISOString(),
                tax_rate: '0', // Kullanıcı hesaba yatan net tutarı girdiği için ek vergi kesintisi uygulanmaz
                is_net: true,
            };

            if (calcMode === 'PER_SHARE') {
                payload.amount_per_share = String(val);
            } else {
                payload.amount = String(val);
            }

            const divId = initialDividend?.id || initialDividend?.ID;
            if (isEditMode && divId) {
                await api.put(`/dividends/${divId}`, payload);
            } else {
                await api.post('/dividends', payload);
            }

            await onSuccess();
            onClose();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setErrorMsg(error.response?.data?.error || 'Temettü kaydedilirken bir hata oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
                {/* Başlık — Sade, profesyonel, abartısız insan tasarımı */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                        <h3 className="text-base font-bold text-white">
                            {isEditMode ? 'Temettü Kaydını Güncelle' : 'Temettü Geliri Ekle'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Banka veya aracı kurum hesabınıza yatan net temettü tutarı
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                        {errorMsg}
                    </div>
                )}

                {stockHoldings.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-300">Portföyünüzde Hisse Senedi Bulunmuyor</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                            Temettü gelirleri yalnızca hisse senetleri için kaydedilebilir. Yatırım fonları, altın ve döviz temettü dağıtmaz.
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 1. Hisse Senedi Seçimi */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                <span>Hisse Senedi</span>
                                {selectedHolding && (
                                    <span className="text-[11px] font-mono text-slate-400">
                                        Mevcut: <strong className="text-slate-200">{selectedHolding.total_amount.toLocaleString('tr-TR')} Lot</strong>
                                    </span>
                                )}
                            </label>
                            <select
                                value={selectedAssetId}
                                onChange={e => setSelectedAssetId(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-[#1A9FD3] cursor-pointer"
                                required
                            >
                                {stockHoldings.map(h => (
                                    <option key={h.asset_id} value={h.asset_id}>
                                        {h.symbol} — {h.asset_name || h.symbol} ({h.total_amount.toLocaleString('tr-TR')} Lot)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Ödeme Tarihi */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Hesaba Geçiş Tarihi</span>
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={e => setPaymentDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                required
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-[#1A9FD3]"
                            />
                        </div>

                        {/* 3. Giriş Yöntemi — Sade 2 Seçenek */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Giriş Türü</label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                                <button
                                    type="button"
                                    onClick={() => setCalcMode('TOTAL')}
                                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                                        calcMode === 'TOTAL'
                                            ? 'bg-[#1A9FD3] text-white shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <span>Hesaba Yatan Toplam</span>
                                    <span className="text-[10px] opacity-75">(Net ₺)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCalcMode('PER_SHARE')}
                                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                                        calcMode === 'PER_SHARE'
                                            ? 'bg-[#1A9FD3] text-white shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <span>Hisse Başına</span>
                                    <span className="text-[10px] opacity-75">(₺/Lot)</span>
                                </button>
                            </div>
                        </div>

                        {/* 4. Net Tutar Girişi */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                {calcMode === 'TOTAL'
                                    ? 'Hesabınıza Geçen Toplam Net Tutar (₺)'
                                    : 'Hisse Başına Hesaba Geçen Net Tutar (₺)'}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    value={amountValue}
                                    onChange={e => setAmountValue(e.target.value)}
                                    placeholder={calcMode === 'TOTAL' ? 'Örn: 5000.00' : 'Örn: 3.50'}
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm sm:text-base font-bold font-mono text-white focus:outline-none focus:border-[#1A9FD3] pr-10"
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                    ₺
                                </span>
                            </div>
                        </div>

                        {/* 5. Otomatik Hesaplama Önizlemesi */}
                        {preview && (
                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span>Portföye Eklenecek Net Nakit:</span>
                                    <span className="font-mono font-bold text-emerald-400 text-sm">
                                        +{preview.totalNet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                    </span>
                                </div>
                                {preview.lots > 0 && (
                                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                        <span>Hesaplama Detayı:</span>
                                        <span className="font-mono">
                                            {preview.lots.toLocaleString('tr-TR')} Lot × {preview.perShareNet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₺/Lot
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Eylem Butonları */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !amountValue}
                                className="flex items-center gap-1.5 px-5 py-2 bg-[#1A9FD3] hover:bg-[#0C6991] disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-md shadow-[#1A9FD3]/20"
                            >
                                {submitting ? 'Kaydediliyor...' : isEditMode ? 'Güncellemeyi Kaydet' : 'Temettüyü Kaydet'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
