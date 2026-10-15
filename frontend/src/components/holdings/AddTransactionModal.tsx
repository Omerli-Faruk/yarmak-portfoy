'use client';

import React, { useId, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { ASSET_TYPE_LABELS, formatTRY } from '@/lib/formatters';
import AssetSearchInput, { type AssetSearchItem } from '@/components/AssetSearchInput';
import TransactionDatePicker from '@/components/TransactionDatePicker';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';

interface AddTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
    initialSymbol?: string;
    initialPrice?: string;
    initialType?: 'BUY' | 'SELL';
    maxLots?: number;
    // initialSymbol'ün türü (HISSE, FON, ALTIN, DOVIZ). Varlık veritabanında yoksa backend fiyat kaynağını buna göre seçer.
    assetType?: string;
}

export default function AddTransactionModal({
    isOpen,
    onClose,
    onSuccess,
    initialSymbol = '',
    initialPrice = '',
    initialType = 'BUY',
    maxLots,
    assetType = 'HISSE',
}: AddTransactionModalProps) {
    const [txSymbol, setTxSymbol] = useState(initialSymbol);
    const [txType, setTxType] = useState<'BUY' | 'SELL'>(initialType);
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState(initialPrice);
    const [txCommission, setTxCommission] = useState('0');
    const [txDate, setTxDate] = useState(() => new Date().toISOString());
    const [isTxDateError, setIsTxDateError] = useState(false);
    const [txSubmitting, setTxSubmitting] = useState(false);
    // Aramadan seçilen varlık; türü buradan gönderilir
    const [pickedAsset, setPickedAsset] = useState<AssetSearchItem | null>(null);

    const formId = useId();
    const symbolId = useId();
    const amountId = useId();
    const priceId = useId();
    const commissionId = useId();

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
            setPickedAsset(null);
        }
    }

    // Sembolle açılmadıysa sembol alanı arama kutusudur
    const searchable = !initialSymbol;
    const symbolUpper = txSymbol.trim().toUpperCase();
    const pickedMatches = pickedAsset !== null && pickedAsset.symbol.toUpperCase() === symbolUpper;

    // Arama sonucundan seçim: sembol, tür ve son fiyat dolar (fiyat elle değiştirilebilir)
    const handlePickAsset = (asset: AssetSearchItem) => {
        setTxSymbol(asset.symbol.toUpperCase());
        setPickedAsset(asset);
        if (asset.price > 0) {
            const decimals = asset.price >= 100 ? 2 : asset.price >= 0.01 ? 4 : 6;
            setTxPrice(String(Number(asset.price.toFixed(decimals))));
        }
    };

    const isExceedingMax = txType === 'SELL' && maxLots !== undefined && parseFloat(txAmount) > maxLots;

    const handleAddTx = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!txSymbol || !txAmount || !txPrice) return;
        if (new Date(txDate).getTime() > Date.now() + 60000) {
            alert('Gelecek tarihli işlem kaydedilemez.');
            return;
        }
        try {
            setTxSubmitting(true);
            const symbol = txSymbol.trim().toUpperCase();
            // Tür: aramadan seçildiyse onun türü; sembolle açıldıysa verilen tür; elle yazıldıysa eskisi gibi HISSE
            const txAssetType = pickedMatches && pickedAsset?.assetType
                ? pickedAsset.assetType.toUpperCase()
                : symbol === initialSymbol.toUpperCase() ? assetType : 'HISSE';
            await api.post('/transactions', {
                symbol,
                asset_type: txAssetType,
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

    const amountNum = parseFloat(txAmount) || 0;
    const priceNum = parseFloat(txPrice) || 0;
    const commissionNum = parseFloat(txCommission) || 0;

    // Alış / Satış seçici: seçili olan kâr ya da zarar renginde yumuşak zeminli
    const typeButton = (value: 'BUY' | 'SELL', label: string) => {
        const isActive = txType === value;
        return (
            <button
                type="button"
                aria-pressed={isActive}
                onClick={() => setTxType(value)}
                className={cn(
                    'flex-1 h-11 sm:h-10 rounded text-sm font-medium cursor-pointer transition-colors duration-[120ms]',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                    isActive
                        ? cn('font-semibold', value === 'BUY' ? 'bg-profit-soft text-profit' : 'bg-loss-soft text-loss')
                        : 'bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg',
                )}
            >
                {label}
            </button>
        );
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!txSubmitting}
            title="İşlem ekle"
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={txSubmitting}>
                        İptal
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        size="sm"
                        loading={txSubmitting}
                        disabled={isTxDateError || Boolean(isExceedingMax)}
                    >
                        {txSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleAddTx} className="flex flex-col gap-3">
                <Field
                    label="Sembol"
                    htmlFor={symbolId}
                    hint={pickedMatches && pickedAsset
                        ? [pickedAsset.name, pickedAsset.assetType && (ASSET_TYPE_LABELS[pickedAsset.assetType.toUpperCase()] ?? pickedAsset.assetType)]
                            .filter(Boolean).join(' · ')
                        : undefined}
                >
                    {searchable ? (
                        <AssetSearchInput
                            id={symbolId}
                            value={txSymbol}
                            onChange={setTxSymbol}
                            onSelect={handlePickAsset}
                            placeholder="Sembol ya da ad yazın (örn. ASELS)"
                            autoFocus
                            required
                            excludeTypes={['ENDEKS']}
                            emptyText="Eşleşen varlık bulunamadı, sembolü tam yazarak da ekleyebilirsiniz"
                        />
                    ) : (
                        <Input
                            id={symbolId}
                            type="text"
                            required
                            value={txSymbol}
                            onChange={e => setTxSymbol(e.target.value.toUpperCase())}
                            placeholder="örn. ASELS, THYAO"
                            className="font-mono font-medium"
                        />
                    )}
                </Field>

                <div role="group" aria-label="İşlem türü" className="flex gap-2">
                    {typeButton('BUY', 'Alış')}
                    {typeButton('SELL', 'Satış')}
                </div>

                <div className="flex gap-3">
                    <Field
                        label="Adet (lot)"
                        htmlFor={amountId}
                        className="flex-1"
                        error={isExceedingMax ? `Mevcut ${maxLots} lottan fazlasını satamazsınız.` : undefined}
                        labelAction={
                            txType === 'SELL' && maxLots !== undefined && maxLots > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setTxAmount(String(maxLots))}
                                    className="inline-flex items-center min-h-11 sm:min-h-10 -my-2.5 sm:-my-2 px-1 rounded font-mono text-sm text-primary cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    title="Eldeki tüm lotları otomatik doldur"
                                >
                                    Tümü: {maxLots.toLocaleString('tr-TR')}
                                </button>
                            ) : undefined
                        }
                    >
                        <Input
                            id={amountId}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0.000001"
                            required
                            value={txAmount}
                            onChange={e => setTxAmount(e.target.value)}
                            placeholder="100"
                            invalid={Boolean(isExceedingMax)}
                        />
                    </Field>
                    <Field label="Birim fiyat (₺)" htmlFor={priceId} className="flex-1">
                        <Input
                            id={priceId}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0.000001"
                            required
                            value={txPrice}
                            onChange={e => setTxPrice(e.target.value)}
                            placeholder="350.50"
                        />
                    </Field>
                </div>

                {/* Tarih ve Saat Seçici */}
                <TransactionDatePicker value={txDate} onChange={setTxDate} onErrorChange={setIsTxDateError} />

                {/* Komisyon */}
                <Field
                    label="Komisyon (₺, isteğe bağlı)"
                    htmlFor={commissionId}
                    hint="Alışta girilen komisyon maliyete eklenir; satışta girilen komisyon gerçekleşen kârdan düşülür."
                >
                    <Input
                        id={commissionId}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={txCommission}
                        onChange={e => setTxCommission(e.target.value)}
                        placeholder="0.00"
                    />
                </Field>

                {/* Toplam İşlem Tutarı Özeti */}
                {parseFloat(txAmount) > 0 && parseFloat(txPrice) > 0 && (
                    <div className="flex flex-col gap-1.5 pt-3 border-t border-border text-sm">
                        <div className="flex items-center justify-between gap-3 text-fg-muted">
                            <span>İşlem tutarı</span>
                            <span className="font-mono text-fg">{formatTRY(amountNum * priceNum)}</span>
                        </div>
                        {parseFloat(txCommission) > 0 && (
                            <div className="flex items-center justify-between gap-3 text-fg-muted">
                                <span>{txType === 'BUY' ? '+' : '-'} Komisyon</span>
                                <span className="font-mono text-fg">{formatTRY(parseFloat(txCommission))}</span>
                            </div>
                        )}
                        {/* Alışta komisyon maliyete eklenir, satışta hesaba geçecek tutardan düşülür */}
                        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                            <span className="font-medium text-fg">{txType === 'BUY' ? 'Toplam maliyet' : 'Net tutar'}</span>
                            <span className="font-mono text-base font-semibold text-fg">
                                {formatTRY((amountNum * priceNum) + (txType === 'BUY' ? commissionNum : -commissionNum))}
                            </span>
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
}
