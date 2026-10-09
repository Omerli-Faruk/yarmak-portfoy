'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { formatTRY } from '@/lib/formatters';
import { normalizeDividend } from '@/lib/normalize';
import { UserHolding, Dividend } from '@/types';

// Bireysel yatırımcıda nakit temettü stopajı 22.12.2024'ten beri %15. Şirkete göre farklı olabildiği için alan düzenlenebilir.
const DEFAULT_TAX_RATE = '15';

// Düzenlemede oran kayıttaki brüt ve stopaj tutarından bulunur; brüt yoksa varsayılan kullanılır.
function taxRateFromRecord(d: Dividend): string {
    const { gross, tax } = normalizeDividend(d);
    return gross > 0 ? String(Math.round((tax / gross) * 100)) : DEFAULT_TAX_RATE;
}

// Yerel saate göre bugünün tarihi (YYYY-MM-DD); toISOString UTC tarihini verir, gece yarısından sonra dün çıkar.
function todayLocalStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

    // Temettü kaydını şimdilik yalnızca hisselere açıyoruz
    const stockHoldings = useMemo(() => {
        return holdings.filter(h => h.asset_type === 'HISSE');
    }, [holdings]);

    const [selectedAssetId, setSelectedAssetId] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState(todayLocalStr);
    const [calcMode, setCalcMode] = useState<'PER_SHARE' | 'TOTAL'>('TOTAL');
    const [amountValue, setAmountValue] = useState('');
    const [taxRateValue, setTaxRateValue] = useState(DEFAULT_TAX_RATE);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Modal her açıldığında form kayıttan doldurulur ya da sıfırlanır
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setErrorMsg(null);
            if (initialDividend) {
                const assetId = Number(initialDividend.asset_id || initialDividend.AssetID || 0);
                setSelectedAssetId(assetId);

                const dateStr = initialDividend.payment_date || initialDividend.PaymentDate || '';
                if (dateStr) {
                    setPaymentDate(new Date(dateStr).toISOString().split('T')[0]);
                } else {
                    setPaymentDate(todayLocalStr());
                }

                const netVal = initialDividend.net_amount || initialDividend.NetAmount || initialDividend.amount || initialDividend.Amount || '';
                setAmountValue(netVal ? parseFloat(netVal).toString() : '');
                setTaxRateValue(taxRateFromRecord(initialDividend));
                setCalcMode('TOTAL');
            } else {
                if (stockHoldings.length > 0) {
                    setSelectedAssetId(stockHoldings[0].asset_id);
                } else {
                    setSelectedAssetId(0);
                }
                setPaymentDate(todayLocalStr());
                setAmountValue('');
                setTaxRateValue(DEFAULT_TAX_RATE);
                setCalcMode('TOTAL');
            }
        }
    }, [isOpen, initialDividend, stockHoldings]);

    const selectedHolding = useMemo(() => {
        return stockHoldings.find(h => h.asset_id === selectedAssetId) || null;
    }, [stockHoldings, selectedAssetId]);

    // Girilen tutara göre hesaba geçecek net nakit önizlemesi
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

        // Net tutar stopaj düşülmüş hâli olduğu için brütü geri hesaplıyoruz: brüt = net / (1 - oran)
        const rate = parseFloat(taxRateValue) / 100;
        const gross = rate >= 0 && rate < 1 ? totalNet / (1 - rate) : totalNet;

        return {
            totalNet,
            perShareNet,
            lots,
            gross,
            tax: gross - totalNet,
        };
    }, [amountValue, calcMode, selectedHolding, taxRateValue]);

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
        const rate = parseFloat(taxRateValue);
        if (isNaN(rate) || rate < 0 || rate >= 100) {
            setErrorMsg('Lütfen geçerli bir stopaj oranı girin (%0 ile %99 arası).');
            return;
        }

        try {
            setSubmitting(true);
            setErrorMsg(null);

            // Hesaba yatan net tutar olduğu gibi kaydedilir; brüt ve stopajı sunucu bu orana göre hesaplar
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
                // Sunucu 1'den büyük değeri yüzde sayıyor; %1 gibi oranlar karışmasın diye oran 0-1 aralığında gönderilir
                tax_rate: String(rate / 100),
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
                {/* Başlık */}
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
                        <p className="text-sm font-semibold text-slate-300">Portföyünüzde hisse senedi bulunmuyor</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                            Temettü kaydı şu an yalnızca hisse senetleri için açık. Yatırım fonlarının çoğu temettü gelirini fon fiyatına yansıtır; altın ve döviz temettü ödemez.
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
                        {/* Hisse seçimi */}
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

                        {/* Ödeme tarihi */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Hesaba Geçiş Tarihi</span>
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={e => setPaymentDate(e.target.value)}
                                max={todayLocalStr()}
                                required
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-[#1A9FD3]"
                            />
                        </div>

                        {/* Toplam ya da hisse başına giriş */}
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

                        {/* Net tutar */}
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

                        {/* Stopaj oranı: brüt tutar ve stopaj bu orana göre hesaplanır */}
                        <div>
                            <label htmlFor="dividend-tax-rate" className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Stopaj oranı (%)
                            </label>
                            <input
                                id="dividend-tax-rate"
                                type="number"
                                step="any"
                                min="0"
                                max="99.99"
                                value={taxRateValue}
                                onChange={e => setTaxRateValue(e.target.value)}
                                required
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-[#1A9FD3]"
                            />
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                Aracı kurumunuzda veya bankanızda hesaba yatan temettü, stopajı zaten kesilmiş net tutardır;
                                ayrıca vergi ödemeniz gerekmez. Bu oran yalnızca brüt tutarı ve kesilen stopajı göstermek için kullanılır.
                                Bireysel yatırımcılar için genel oran %15&apos;tir, bazı şirketlerde daha düşük olabilir.
                            </p>
                        </div>

                        {/* Önizleme */}
                        {preview && (
                            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span>
                                        {calcMode === 'PER_SHARE' ? 'Portföye Eklenecek Net Nakit (tahmini):' : 'Portföye Eklenecek Net Nakit:'}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-400 text-sm">
                                        {formatTRY(preview.totalNet, 2, true)}
                                    </span>
                                </div>
                                {preview.tax > 0 && (
                                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                        <span>Brüt tutar / kesilen stopaj:</span>
                                        <span className="font-mono">
                                            {formatTRY(preview.gross)} / {formatTRY(preview.tax)}
                                        </span>
                                    </div>
                                )}
                                {preview.lots > 0 && (
                                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                        <span>Hesaplama Detayı:</span>
                                        <span className="font-mono">
                                            {preview.lots.toLocaleString('tr-TR')} Lot × {preview.perShareNet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₺/Lot
                                        </span>
                                    </div>
                                )}
                                {calcMode === 'PER_SHARE' && (
                                    <p className="text-slate-500 text-[11px]">
                                        Kayıtta, ödeme tarihindeki lot sayınız kullanılır.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Butonlar */}
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
