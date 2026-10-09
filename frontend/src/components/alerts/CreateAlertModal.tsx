'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Bell, Info, Plus, RefreshCw, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { formatPriceTR, formatSignedPercent } from '@/lib/formatters';

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
    // Varlık sayfasından ?symbol= ile gelindiğinde dolu olur
    initialSymbol?: string;
    onClose: () => void;
    onCreated: () => void;
}

type Direction = 'ABOVE' | 'BELOW';

// Hedef fiyatı fiyat büyüklüğüne göre yuvarlar (formatPriceTR ile aynı basamak sayısı).
// 1 TL altındaki fonlarda 2 basamağa yuvarlamak hedefi son fiyatın öbür tarafına atabiliyor.
const toTargetString = (price: number): string => price.toFixed(price < 0.01 ? 6 : price < 1 ? 4 : 2);

export default function CreateAlertModal({ initialSymbol, onClose, onCreated }: CreateAlertModalProps) {
    const [modalSymbolSearch, setModalSymbolSearch] = useState(initialSymbol ?? '');
    const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
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

    // Yazılan sembolü 300 ms bekleyip ara; varlık seçiliyse arama yapılmaz
    useEffect(() => {
        if (!modalSymbolSearch.trim() || selectedAsset) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/assets?q=${encodeURIComponent(modalSymbolSearch.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setSearchResults(
                            data.slice(0, 6).map((item: ApiAssetResponse) => ({
                                id: item.id,
                                symbol: item.symbol,
                                name: item.name || item.symbol,
                                price: parseFloat(item.current_price || item.price || '0') || 0,
                                type: item.asset_type || item.type,
                            }))
                        );
                    }
                }
            } catch (err) {
                console.error('Varlık arama hatası:', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [modalSymbolSearch, selectedAsset]);

    const handleSelectAsset = async (asset: AssetSearchResult) => {
        setModalSymbolSearch(asset.symbol);
        setSearchResults([]);

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
                <p className="text-[11px] font-semibold text-rose-400 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                        Hedef fiyat ({formatPriceTR(parsed)}), son fiyattan ({formatPriceTR(selectedAsset.price)}){' '}
                        {direction === 'ABOVE' ? 'yüksek' : 'düşük'} olmalıdır.
                    </span>
                </p>
            );
        }

        const diffPct = ((parsed - selectedAsset.price) / selectedAsset.price) * 100;
        return (
            <p className="text-[11px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
                <span>Son fiyata göre:</span>
                <span className={`font-bold ${diffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatSignedPercent(diffPct)}
                </span>
            </p>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
            >
                <button
                    onClick={onClose}
                    className="absolute right-5 top-5 text-slate-400 hover:text-white transition cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        <Bell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-foreground">Yeni Fiyat Alarmı Kur</h3>
                        <p className="text-xs text-slate-400">Hedef fiyatı belirleyin, tetiklendiğinde görün.</p>
                    </div>
                </div>

                <form onSubmit={handleCreateAlert} className="space-y-5">
                    <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-2">Varlık</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={modalSymbolSearch}
                                onChange={(e) => {
                                    setModalSymbolSearch(e.target.value.toUpperCase());
                                    setSelectedAsset(null);
                                }}
                                placeholder="Sembol yazın (örn: THYAO, TUPRS)"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:border-primary uppercase font-bold"
                                required
                            />
                            {isSearching && (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                </div>
                            )}
                        </div>

                        {searchResults.length > 0 && !selectedAsset && (
                            <div className="mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto z-10">
                                {searchResults.map((res) => (
                                    <button
                                        key={res.symbol}
                                        type="button"
                                        onClick={() => handleSelectAsset(res)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer"
                                    >
                                        <div>
                                            <span className="text-xs font-black text-white mr-2">{res.symbol}</span>
                                            <span className="text-[11px] text-slate-400 truncate">{res.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-primary">
                                            {res.price > 0 ? formatPriceTR(res.price) : ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedAsset && (
                            <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-black text-primary mr-2">{selectedAsset.symbol}</span>
                                    <span className="text-[11px] text-slate-300">{selectedAsset.name}</span>
                                </div>
                                <span className="text-xs font-bold text-foreground">
                                    Son fiyat: {selectedAsset.price > 0 ? formatPriceTR(selectedAsset.price) : '— ₺'}
                                </span>
                            </div>
                        )}

                        {isFund && (
                            <p className="text-[11px] text-slate-400 mt-2 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                                <span>
                                    Fon fiyatları günde bir kez açıklandığı için fon alarmları, yeni fiyat TEFAS&apos;ta
                                    yayımlanıp sisteme alındığında kontrol edilir.
                                </span>
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-2">Alarm Koşulu</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleDirectionChange('ABOVE')}
                                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                                    direction === 'ABOVE'
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                    <ArrowUpRight className="w-4 h-4" />
                                    <span>Fiyat Yükselirse</span>
                                </div>
                                <span className="text-[10px] opacity-80">Fiyat hedefe ulaşınca veya geçince</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDirectionChange('BELOW')}
                                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                                    direction === 'BELOW'
                                        ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                    <ArrowDownRight className="w-4 h-4" />
                                    <span>Fiyat Düşerse</span>
                                </div>
                                <span className="text-[10px] opacity-80">Fiyat hedefe inince veya altına düşünce</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-2">Hedef Fiyat (₺)</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={targetPriceInput}
                                onChange={(e) => handlePriceInputChange(e.target.value)}
                                placeholder="Örn: 350,50"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:border-primary font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                ₺
                            </span>
                        </div>

                        {renderTargetHint()}

                        {selectedAsset && selectedAsset.price > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-slate-500 font-medium">Hızlı:</span>
                                {(direction === 'ABOVE' ? [2, 5, 10, 15] : [-2, -5, -10, -15]).map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handleQuickPercent(pct)}
                                        className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer border border-white/5"
                                    >
                                        {formatSignedPercent(pct, 0)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {formError && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{formError}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white transition text-xs font-bold cursor-pointer"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedAsset}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Kaydediliyor...</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Alarmı Başlat</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
