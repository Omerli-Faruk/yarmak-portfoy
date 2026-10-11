'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { formatTRY } from '@/lib/formatters';
import { normalizeDividend } from '@/lib/normalize';
import { UserHolding, Dividend } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SegmentedControl from '@/components/ui/SegmentedControl';

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

// Kaydet düğmesi pencerenin alt kısmında, formun dışında durduğu için forma id ile bağlanır
const FORM_ID = 'dividend-form';

type CalcMode = 'PER_SHARE' | 'TOTAL';

const CALC_MODE_OPTIONS: { value: CalcMode; label: React.ReactNode }[] = [
    { value: 'TOTAL', label: 'Toplam tutar' },
    { value: 'PER_SHARE', label: 'Hisse başına' },
];

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
    const [calcMode, setCalcMode] = useState<CalcMode>('TOTAL');
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

    const hasStocks = stockHoldings.length > 0;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Temettüyü düzenle' : 'Temettü ekle'}
            size="md"
            dismissible={!submitting}
            footer={
                hasStocks ? (
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={submitting}>
                            Vazgeç
                        </Button>
                        <Button type="submit" form={FORM_ID} loading={submitting} disabled={!amountValue}>
                            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </>
                ) : (
                    <Button variant="secondary" onClick={onClose}>
                        Kapat
                    </Button>
                )
            }
        >
            {errorMsg && (
                <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2 text-sm text-loss">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {!hasStocks ? (
                <div className="flex flex-col items-center gap-1 py-4 text-center">
                    <p className="text-base font-medium text-fg">Portföyünüzde hisse senedi bulunmuyor</p>
                    <p className="max-w-sm text-sm text-fg-muted leading-relaxed">
                        Temettü kaydı şu an yalnızca hisse senetleri için açık. Yatırım fonlarının çoğu temettü gelirini fon fiyatına yansıtır; altın ve döviz temettü ödemez.
                    </p>
                </div>
            ) : (
                <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-3">
                    {/* Hisse seçimi; eldeki lot seçenek metninde yazar */}
                    <Field
                        label="Hisse"
                        htmlFor="dividend-asset"
                    >
                        <Select
                            id="dividend-asset"
                            value={selectedAssetId}
                            onChange={e => setSelectedAssetId(Number(e.target.value))}
                            required
                        >
                            {stockHoldings.map(h => (
                                <option key={h.asset_id} value={h.asset_id}>
                                    {h.symbol} — {h.asset_name || h.symbol} ({h.total_amount.toLocaleString('tr-TR')} lot)
                                </option>
                            ))}
                        </Select>
                    </Field>

                    {/* Ödeme tarihi */}
                    <Field
                        label="Ödeme tarihi"
                        htmlFor="dividend-date"
                    >
                        <Input
                            id="dividend-date"
                            type="date"
                            value={paymentDate}
                            onChange={e => setPaymentDate(e.target.value)}
                            max={todayLocalStr()}
                            required
                            className="font-mono"
                        />
                    </Field>

                    {/* Toplam ya da hisse başına giriş */}
                    <div className="flex flex-col gap-1">
                        <span className="text-13 font-medium text-fg">Giriş türü</span>
                        <SegmentedControl
                            options={CALC_MODE_OPTIONS}
                            value={calcMode}
                            onChange={setCalcMode}
                            size="sm"
                            fullWidth
                            ariaLabel="Giriş türü"
                        />
                    </div>

                    {/* Net tutar */}
                    <Field
                        label={calcMode === 'TOTAL'
                            ? 'Hesaba yatan net tutar'
                            : 'Hisse başına net tutar'}
                        htmlFor="dividend-amount"
                    >
                        <Input
                            id="dividend-amount"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0.0001"
                            value={amountValue}
                            onChange={e => setAmountValue(e.target.value)}
                            placeholder={calcMode === 'TOTAL' ? 'örn. 5000.00' : 'örn. 3.50'}
                            required
                            rightSlot={<span className="font-mono">₺</span>}
                            className="font-medium"
                        />
                    </Field>

                    {/* Stopaj oranı: brüt tutar ve stopaj bu orana göre hesaplanır */}
                    <Field
                        label="Stopaj oranı (%)"
                        htmlFor="dividend-tax-rate"
                        hint={
                            <>
                                Aracı kurumunuzda veya bankanızda hesaba yatan temettü, stopajı zaten kesilmiş net tutardır;
                                ayrıca vergi ödemeniz gerekmez. Bu oran yalnızca brüt tutarı ve kesilen stopajı göstermek için kullanılır.
                                Bireysel yatırımcılar için genel oran %15&apos;tir, bazı şirketlerde daha düşük olabilir.
                            </>
                        }
                    >
                        <Input
                            id="dividend-tax-rate"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            max="99.99"
                            value={taxRateValue}
                            onChange={e => setTaxRateValue(e.target.value)}
                            required
                        />
                    </Field>

                    {/* Önizleme: kutusuz, üstte ince çizgiyle formdan ayrılır */}
                    {preview && (
                        <div className="flex flex-col gap-2 border-t border-border pt-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium text-fg">
                                    {calcMode === 'PER_SHARE' ? 'Eklenecek net nakit (tahmini)' : 'Eklenecek net nakit'}
                                </span>
                                <span className="shrink-0 font-mono text-base font-semibold text-profit">
                                    {formatTRY(preview.totalNet, 2, true)}
                                </span>
                            </div>
                            {preview.tax > 0 && (
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-fg-muted">Brüt / kesilen stopaj</span>
                                    <span className="text-right font-mono text-fg">
                                        {formatTRY(preview.gross)} / {formatTRY(preview.tax)}
                                    </span>
                                </div>
                            )}
                            {preview.lots > 0 && (
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-fg-muted">Hesaplama</span>
                                    <span className="text-right font-mono text-fg">
                                        {preview.lots.toLocaleString('tr-TR')} lot × {preview.perShareNet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₺/lot
                                    </span>
                                </div>
                            )}
                            {calcMode === 'PER_SHARE' && (
                                <p className="text-sm text-fg-muted">
                                    Kayıtta, ödeme tarihindeki lot sayınız kullanılır.
                                </p>
                            )}
                        </div>
                    )}
                </form>
            )}
        </Modal>
    );
}
