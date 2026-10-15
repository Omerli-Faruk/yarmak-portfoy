'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { AlertCircle, Info, Plus } from 'lucide-react';
import api from '@/lib/api';
import { formatPriceTR, formatSignedPercent } from '@/lib/formatters';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';
import ChangePill from '@/components/ui/ChangePill';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import AssetSearchInput, { type AssetSearchItem } from '@/components/AssetSearchInput';

interface AssetSearchResult {
    id?: number;
    symbol: string;
    name: string;
    price: number;
    type?: string;
}

interface ApiAssetResponse {
    id?: number;
    symbol: string;
    name?: string;
    price?: string;
    current_price?: string;
    type?: string;
    asset_type?: string;
}

interface CreateAlertModalProps {
    // Varlık sayfasından ?sembol= ile gelindiğinde dolu olur
    initialSymbol?: string;
    onClose: () => void;
    onCreated: () => void;
}

type Direction = 'ABOVE' | 'BELOW';

// Hedef fiyatı fiyat büyüklüğüne göre yuvarlar (formatPriceTR ile aynı basamak sayısı).
// 1 TL altındaki fonlarda 2 basamağa yuvarlamak hedefi son fiyatın öbür tarafına atabiliyor.
const toTargetString = (price: number): string => price.toFixed(price < 0.01 ? 6 : price < 1 ? 4 : 2);

const FORM_ID = 'create-alert-form';

export default function CreateAlertModal({ initialSymbol, onClose, onCreated }: CreateAlertModalProps) {
    const [modalSymbolSearch, setModalSymbolSearch] = useState(initialSymbol ?? '');
    const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
    const [direction, setDirection] = useState<Direction>('ABOVE');
    const [targetPriceInput, setTargetPriceInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Sembolle açıldıysa varlığı önce veritabanında, bulunamazsa arama API'sinde ara ve seçili getir
    useEffect(() => {
        if (!initialSymbol) return;
        const sym = initialSymbol;
        let cancelled = false;

        (async () => {
            try {
                const lookupRes = await api.get(`/assets/lookup?symbol=${encodeURIComponent(sym)}`);
                if (cancelled) return;
                if (lookupRes.data) {
                    const d = lookupRes.data;
                    const price = parseFloat(d.CurrentPrice || d.current_price || '0') || 0;
                    setSelectedAsset({
                        id: d.ID || d.id,
                        symbol: d.Symbol || d.symbol || sym,
                        name: d.Name || d.name || sym,
                        price,
                        type: d.AssetType || d.asset_type || 'HISSE',
                    });
                    if (price > 0) {
                        setTargetPriceInput(toTargetString(price * 1.05));
                    }
                    return;
                }
            } catch {
                // Veritabanında yoksa arama API'sine geçilir
            }

            try {
                const res = await fetch(`/api/assets?q=${encodeURIComponent(sym)}`);
                if (!res.ok) return;
                const items = await res.json();
                if (cancelled || !Array.isArray(items) || items.length === 0) return;
                const exact = items.find((i: ApiAssetResponse) => i.symbol.toUpperCase() === sym) || items[0];
                const price = parseFloat(exact.current_price || exact.price || '0') || 0;
                setSelectedAsset({
                    id: exact.id,
                    symbol: exact.symbol,
                    name: exact.name || exact.symbol,
                    price,
                    type: exact.asset_type || exact.type,
                });
                if (price > 0) {
                    setTargetPriceInput(toTargetString(price * 1.05));
                }
            } catch (e) {
                console.error('Ön yükleme hatası:', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [initialSymbol]);

    // Arama kutusundan seçilen varlık (arama ve liste AssetSearchInput'ta)
    const handleSelectAsset = async (picked: AssetSearchItem) => {
        const asset: AssetSearchResult = { id: picked.id, symbol: picked.symbol, name: picked.name, price: picked.price, type: picked.assetType };
        setModalSymbolSearch(asset.symbol);

        let currentPrice = asset.price;
        let assetId = asset.id;

        // Fiyat yoksa ya da id eksik veya geçici (9900 ve üstü makro id) ise veritabanındaki kaydı al
        if (!assetId || assetId >= 9900 || currentPrice <= 0) {
            try {
                const lookupRes = await api.get(`/assets/lookup?symbol=${encodeURIComponent(asset.symbol)}`);
                if (lookupRes.data) {
                    const d = lookupRes.data;
                    assetId = d.ID || d.id || assetId;
                    const lp = parseFloat(d.CurrentPrice || d.current_price || '0') || 0;
                    if (lp > 0) currentPrice = lp;
                }
            } catch {
                // Bulunamazsa arama sonucundaki bilgilerle devam edilir
            }
        }

        setSelectedAsset({ ...asset, id: assetId, price: currentPrice });

        if (currentPrice > 0) {
            const multiplier = direction === 'ABOVE' ? 1.05 : 0.95;
            setTargetPriceInput(toTargetString(currentPrice * multiplier));
        }
    };

    // Fiyat elle yazıldığında yönü son fiyata göre otomatik seç
    const handlePriceInputChange = (val: string) => {
        const filtered = val.replace(/[^0-9.,]/g, '');
        setTargetPriceInput(filtered);
        setFormError('');
        const parsed = parseFloat(filtered.replace(',', '.').trim());
        if (!isNaN(parsed) && selectedAsset && selectedAsset.price > 0) {
            if (parsed > selectedAsset.price) {
                setDirection('ABOVE');
            } else if (parsed < selectedAsset.price) {
                setDirection('BELOW');
            }
        }
    };

    // Hızlı yüzde düğmeleri: hedefi son fiyatın verilen yüzde kadar üstüne veya altına koyar
    const handleQuickPercent = (pct: number) => {
        if (!selectedAsset || selectedAsset.price <= 0) return;
        setFormError('');
        setTargetPriceInput(toTargetString(selectedAsset.price * (1 + pct / 100)));
        setDirection(pct >= 0 ? 'ABOVE' : 'BELOW');
    };

    // Yön değişince mevcut hedef yeni yönle çelişiyorsa son fiyatın %5 üstü/altı önerilir
    const handleDirectionChange = (next: Direction) => {
        setDirection(next);
        setFormError('');
        if (selectedAsset && selectedAsset.price > 0) {
            const parsed = parseFloat(targetPriceInput.replace(',', '.').trim());
            const conflicts = next === 'ABOVE' ? parsed <= selectedAsset.price : parsed >= selectedAsset.price;
            if (isNaN(parsed) || conflicts) {
                setTargetPriceInput(toTargetString(selectedAsset.price * (next === 'ABOVE' ? 1.05 : 0.95)));
            }
        }
    };

    const handleCreateAlert = async (e: FormEvent) => {
        e.preventDefault();
        setFormError('');

        const targetPriceNum = parseFloat(targetPriceInput.replace(',', '.').trim());
        if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
            setFormError('Lütfen 0’dan büyük geçerli bir hedef fiyat girin.');
            return;
        }

        const sym = selectedAsset?.symbol || modalSymbolSearch.trim().toUpperCase();
        if (!sym) {
            setFormError('Lütfen bir hisse veya fon seçin.');
            return;
        }

        // Hedef, seçilen yönle tutarlı olmalı
        if (selectedAsset && selectedAsset.price > 0) {
            const last = formatPriceTR(selectedAsset.price);
            if (targetPriceNum === selectedAsset.price) {
                setFormError(`Hedef fiyat, son fiyata (${last}) eşit olamaz.`);
                return;
            }
            if (direction === 'ABOVE' && targetPriceNum < selectedAsset.price) {
                setFormError(`"Fiyat Yükselirse" alarmı için hedef fiyat (${formatPriceTR(targetPriceNum)}), son fiyattan (${last}) yüksek olmalıdır.`);
                return;
            }
            if (direction === 'BELOW' && targetPriceNum > selectedAsset.price) {
                setFormError(`"Fiyat Düşerse" alarmı için hedef fiyat (${formatPriceTR(targetPriceNum)}), son fiyattan (${last}) düşük olmalıdır.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let assetId = selectedAsset?.id;
            // id yoksa veya geçici makro id ise gerçek veritabanı id'si alınır
            if (!assetId || assetId >= 9900) {
                const lookupRes = await api.get(`/assets/lookup?symbol=${encodeURIComponent(sym)}`);
                assetId = lookupRes.data?.ID || lookupRes.data?.id;
            }

            if (!assetId || assetId <= 0) {
                setFormError('Varlık sistemde bulunamadı veya veritabanına kaydedilemedi.');
                setIsSubmitting(false);
                return;
            }

            await api.post('/alerts', {
                asset_id: assetId,
                symbol: sym,
                target_price: toTargetString(targetPriceNum),
                direction: direction,
            });

            onCreated();
        } catch (err: unknown) {
            console.error('Alarm kurma hatası:', err);
            const apiErr = err as { response?: { data?: { error?: string } } };
            setFormError(apiErr.response?.data?.error || 'Alarm oluşturulurken bir hata meydana geldi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFund = selectedAsset?.type?.toUpperCase() === 'FON';

    // Hedefin son fiyata göre farkı ya da seçilen yönle çelişki uyarısı
    const renderTargetHint = () => {
        if (!selectedAsset || selectedAsset.price <= 0 || !targetPriceInput) return null;
        const parsed = parseFloat(targetPriceInput.replace(',', '.').trim());
        if (isNaN(parsed) || parsed <= 0) return null;

        const isMismatch =
            (direction === 'ABOVE' && parsed < selectedAsset.price) ||
            (direction === 'BELOW' && parsed > selectedAsset.price);
        if (isMismatch) {
            return (
                <p className="flex items-start gap-1.5 text-sm text-loss">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
                    <span>
                        Hedef fiyat ({formatPriceTR(parsed)}), son fiyattan ({formatPriceTR(selectedAsset.price)}){' '}
                        {direction === 'ABOVE' ? 'yüksek' : 'düşük'} olmalıdır.
                    </span>
                </p>
            );
        }

        const diffPct = ((parsed - selectedAsset.price) / selectedAsset.price) * 100;
        return (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
                <span>Son fiyata göre:</span>
                <ChangePill value={diffPct} />
            </div>
        );
    };

    // Yön seçeneği: düz, zeminsiz; seçiliyken çerçeve ve başlık yön renginde, değilken nötr ince çizgi
    const directionOptionClass = (option: Direction) =>
        cn(
            'flex flex-1 basis-0 min-w-0 min-h-11 flex-col gap-0.5 rounded border px-3 py-2.5 text-left cursor-pointer',
            'transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            direction === option
                ? option === 'ABOVE' ? 'border-profit' : 'border-loss'
                : 'border-border hover:border-border-strong hover:bg-surface-2',
        );

    const directionTitleClass = (option: Direction) =>
        cn(
            'flex items-center gap-1.5 text-sm font-medium',
            direction === option ? (option === 'ABOVE' ? 'text-profit' : 'text-loss') : 'text-fg-muted',
        );

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!isSubmitting}
            title="Yeni fiyat alarmı"
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
                        Vazgeç
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        size="sm"
                        loading={isSubmitting}
                        disabled={!selectedAsset}
                        leftIcon={<Plus />}
                    >
                        {isSubmitting ? 'Kaydediliyor...' : 'Alarmı kur'}
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleCreateAlert} className="flex flex-col gap-4">
                <Field label="Varlık" htmlFor="alert-symbol">
                    <AssetSearchInput
                        id="alert-symbol"
                        value={modalSymbolSearch}
                        onChange={(val) => {
                            setModalSymbolSearch(val);
                            setSelectedAsset(null);
                        }}
                        onSelect={handleSelectAsset}
                        searchEnabled={!selectedAsset}
                        placeholder="Sembol yazın (örn: THYAO, TUPRS)"
                        required
                    />

                    {selectedAsset && (
                        <div className="flex items-center gap-3 border-y border-border py-2.5">
                            <div className="flex flex-1 min-w-0 flex-col">
                                <span className="font-mono text-sm font-medium text-fg">{selectedAsset.symbol}</span>
                                <span className="text-xs text-fg-muted truncate">{selectedAsset.name}</span>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-xs text-fg-muted">Son fiyat</span>
                                <span className="font-mono text-sm font-medium text-fg whitespace-nowrap">
                                    {selectedAsset.price > 0 ? formatPriceTR(selectedAsset.price) : '— ₺'}
                                </span>
                            </div>
                        </div>
                    )}

                    {isFund && (
                        <p className="flex items-start gap-1.5 text-xs text-fg-muted">
                            <Info className="size-4 shrink-0 mt-px text-fg-muted" aria-hidden />
                            <span>
                                Fon fiyatları günde bir kez açıklandığı için fon alarmları, yeni fiyat TEFAS&apos;ta
                                yayımlanıp sisteme alındığında kontrol edilir.
                            </span>
                        </p>
                    )}
                </Field>

                <div className="flex flex-col gap-1">
                    <span id="alert-direction-label" className="text-sm font-medium text-fg">
                        Alarm koşulu
                    </span>
                    <div role="group" aria-labelledby="alert-direction-label" className="flex gap-2">
                        <button
                            type="button"
                            aria-pressed={direction === 'ABOVE'}
                            onClick={() => handleDirectionChange('ABOVE')}
                            className={directionOptionClass('ABOVE')}
                        >
                            <span className={directionTitleClass('ABOVE')}>
                                <span aria-hidden className="text-[0.8em] leading-none">▲</span>
                                <span>Fiyat yükselirse</span>
                            </span>
                            <span className="text-xs text-fg-muted">Fiyat hedefe ulaşınca veya geçince</span>
                        </button>

                        <button
                            type="button"
                            aria-pressed={direction === 'BELOW'}
                            onClick={() => handleDirectionChange('BELOW')}
                            className={directionOptionClass('BELOW')}
                        >
                            <span className={directionTitleClass('BELOW')}>
                                <span aria-hidden className="text-[0.8em] leading-none">▼</span>
                                <span>Fiyat düşerse</span>
                            </span>
                            <span className="text-xs text-fg-muted">Fiyat hedefe inince veya altına düşünce</span>
                        </button>
                    </div>
                </div>

                <Field label="Hedef fiyat" htmlFor="alert-target">
                    <Input
                        id="alert-target"
                        type="text"
                        inputMode="decimal"
                        value={targetPriceInput}
                        onChange={(e) => handlePriceInputChange(e.target.value)}
                        placeholder="Örn: 350,50"
                        autoComplete="off"
                        className="font-medium"
                        rightSlot={<span className="font-mono">₺</span>}
                        required
                    />

                    {renderTargetHint()}

                    {selectedAsset && selectedAsset.price > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-xs text-fg-muted">Hızlı:</span>
                            {(direction === 'ABOVE' ? [2, 5, 10, 15] : [-2, -5, -10, -15]).map((pct) => (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => handleQuickPercent(pct)}
                                    className="min-h-11 sm:min-h-10 rounded border border-border px-3 font-mono text-sm text-fg cursor-pointer transition-colors duration-[120ms] hover:border-border-strong hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    {formatSignedPercent(pct, 0)}
                                </button>
                            ))}
                        </div>
                    )}
                </Field>

                {formError && (
                    <div role="alert" className="flex items-start gap-2 rounded border border-loss bg-loss-soft px-3 py-2.5 text-sm text-loss">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
                        <span>{formError}</span>
                    </div>
                )}
            </form>
        </Modal>
    );
}
