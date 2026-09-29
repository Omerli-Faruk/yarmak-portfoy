'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
    Bell,
    BellRing,
    Plus,
    Trash2,
    TrendingUp,
    TrendingDown,
    Search,
    RefreshCw,
    X,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    ExternalLink,
    AlertCircle,
    Percent,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/formatters';

interface RawPriceAlert {
    ID?: number;
    id?: number;
    UserID?: number;
    user_id?: number;
    AssetID?: number;
    asset_id?: number;
    TargetPrice?: string;
    target_price?: string;
    Direction?: 'ABOVE' | 'BELOW';
    direction?: 'ABOVE' | 'BELOW';
    IsTriggered?: boolean;
    is_triggered?: boolean;
    TriggeredAt?: { Time: string; Valid: boolean } | string | null;
    triggered_at?: { Time: string; Valid: boolean } | string | null;
    CreatedAt?: string;
    created_at?: string;
    Symbol?: string;
    symbol?: string;
    AssetName?: string;
    asset_name?: string;
    CurrentPrice?: string;
    current_price?: string;
}

interface NormalizedAlert {
    id: number;
    symbol: string;
    assetName: string;
    targetPrice: number;
    currentPrice: number;
    direction: 'ABOVE' | 'BELOW';
    isTriggered: boolean;
    triggeredAt: string | null;
    createdAt: string;
    percentDiff: number;
}

interface AssetSearchResult {
    id?: number;
    symbol: string;
    name: string;
    price: number;
    type?: string;
}

function AlertsContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const querySymbol = searchParams.get('symbol');

    const [alerts, setAlerts] = useState<NormalizedAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'TRIGGERED'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalSymbolSearch, setModalSymbolSearch] = useState('');
    const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
    const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
    const [targetPriceInput, setTargetPriceInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Fetch Alerts
    const fetchAlerts = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const res = await api.get('/alerts');
            const data: RawPriceAlert[] = Array.isArray(res.data) ? res.data : [];
            const normalized: NormalizedAlert[] = data.map((a) => {
                const id = a.ID ?? a.id ?? 0;
                const symbol = a.Symbol ?? a.symbol ?? '';
                const assetName = a.AssetName ?? a.asset_name ?? symbol;
                const targetPrice = parseFloat(a.TargetPrice ?? a.target_price ?? '0') || 0;
                const currentPrice = parseFloat(a.CurrentPrice ?? a.current_price ?? '0') || 0;
                const dir = (a.Direction ?? a.direction ?? 'ABOVE') as 'ABOVE' | 'BELOW';
                const isTriggered = Boolean(a.IsTriggered ?? a.is_triggered);

                let triggeredAt: string | null = null;
                const rawTriggered = a.TriggeredAt ?? a.triggered_at;
                if (rawTriggered) {
                    if (typeof rawTriggered === 'object' && rawTriggered.Valid && rawTriggered.Time) {
                        triggeredAt = rawTriggered.Time;
                    } else if (typeof rawTriggered === 'string') {
                        triggeredAt = rawTriggered;
                    }
                }

                const createdAt = a.CreatedAt ?? a.created_at ?? '';

                let percentDiff = 0;
                if (currentPrice > 0) {
                    percentDiff = ((targetPrice - currentPrice) / currentPrice) * 100;
                }

                return {
                    id,
                    symbol,
                    assetName,
                    targetPrice,
                    currentPrice,
                    direction: dir,
                    isTriggered,
                    triggeredAt,
                    createdAt,
                    percentDiff,
                };
            });
            setAlerts(normalized);
        } catch (err) {
            console.error('Alarmlar yüklenirken hata:', err);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    // Check for query param ?symbol=THYAO to auto-open modal
    useEffect(() => {
        if (querySymbol) {
            setIsModalOpen(true);
            const sym = querySymbol.toUpperCase();
            setModalSymbolSearch(sym);
            (async () => {
                try {
                    const lookupRes = await api.get(`/assets/lookup?symbol=${encodeURIComponent(sym)}`);
                    if (lookupRes.data) {
                        const d = lookupRes.data;
                        const price = parseFloat(d.CurrentPrice || d.current_price || '0') || 0;
                        const id = d.ID || d.id;
                        setSelectedAsset({
                            id,
                            symbol: d.Symbol || d.symbol || sym,
                            name: d.Name || d.name || sym,
                            price,
                            type: d.AssetType || d.asset_type || 'HISSE',
                        });
                        if (price > 0) {
                            setTargetPriceInput((price * 1.05).toFixed(2));
                        }
                        return;
                    }
                } catch {
                    // fallback
                }

                try {
                    const res = await fetch(`/api/assets?q=${encodeURIComponent(sym)}`);
                    if (res.ok) {
                        const items = await res.json();
                        if (Array.isArray(items) && items.length > 0) {
                            const exact = items.find((i: any) => i.symbol.toUpperCase() === sym) || items[0];
                            const price = parseFloat(exact.current_price || exact.price || '0') || 0;
                            setSelectedAsset({
                                id: exact.id,
                                symbol: exact.symbol,
                                name: exact.name || exact.symbol,
                                price,
                                type: exact.asset_type || exact.type,
                            });
                            if (price > 0) {
                                setTargetPriceInput((price * 1.05).toFixed(2));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Ön yükleme hatası:', e);
                }
            })();
        }
    }, [querySymbol]);

    // Live search for asset inside modal
    useEffect(() => {
        if (!modalSymbolSearch.trim() || selectedAsset) {
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
                            data.slice(0, 6).map((item: any) => ({
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

    // Select an asset
    const handleSelectAsset = async (asset: AssetSearchResult) => {
        setModalSymbolSearch(asset.symbol);
        setSearchResults([]);

        let currentPrice = asset.price;
        let assetId = asset.id;

        // If price is 0 or id is missing / fake macro id, fetch exact DB details
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
                // keep asset as is
            }
        }

        const resolvedAsset: AssetSearchResult = {
            ...asset,
            id: assetId,
            price: currentPrice,
        };

        setSelectedAsset(resolvedAsset);

        if (currentPrice > 0) {
            const multiplier = direction === 'ABOVE' ? 1.05 : 0.95;
            setTargetPriceInput((currentPrice * multiplier).toFixed(2));
        }
    };

    // Fiyat elle yazıldığında yönü otomatik algıla
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

    // Quick percentage calculator button
    const handleQuickPercent = (pct: number) => {
        if (!selectedAsset || selectedAsset.price <= 0) return;
        setFormError('');
        const newTarget = selectedAsset.price * (1 + pct / 100);
        setTargetPriceInput(newTarget.toFixed(2));
        if (pct >= 0) {
            setDirection('ABOVE');
        } else {
            setDirection('BELOW');
        }
    };

    // Create Alert
    const handleCreateAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const cleanPriceStr = targetPriceInput.replace(',', '.').trim();
        const targetPriceNum = parseFloat(cleanPriceStr);
        if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
            setFormError('Lütfen 0’dan büyük geçerli bir hedef fiyat girin.');
            return;
        }

        const sym = selectedAsset?.symbol || modalSymbolSearch.trim().toUpperCase();
        if (!sym) {
            setFormError('Lütfen bir hisse veya fon seçin.');
            return;
        }

        // Mantıksal Yön ve Fiyat Doğrulaması
        if (selectedAsset && selectedAsset.price > 0) {
            if (targetPriceNum === selectedAsset.price) {
                setFormError(`Hedef fiyat, anlık fiyata (${formatMoney(selectedAsset.price)}) eşit olamaz.`);
                return;
            }
            if (direction === 'ABOVE' && targetPriceNum < selectedAsset.price) {
                setFormError(`"Fiyat Yükselirse" alarmı için hedef fiyat (${formatMoney(targetPriceNum)}), anlık fiyattan (${formatMoney(selectedAsset.price)}) yüksek olmalıdır.`);
                return;
            }
            if (direction === 'BELOW' && targetPriceNum > selectedAsset.price) {
                setFormError(`"Fiyat Düşerse" alarmı için hedef fiyat (${formatMoney(targetPriceNum)}), anlık fiyattan (${formatMoney(selectedAsset.price)}) düşük olmalıdır.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let assetId = selectedAsset?.id;
            // Asset ID eksikse veya makro ID ise /assets/lookup üzerinden gerçek DB ID'sini doğrula
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
                target_price: targetPriceNum.toFixed(2),
                direction: direction,
            });

            setIsModalOpen(false);
            resetModal();
            fetchAlerts(true);
        } catch (err: any) {
            console.error('Alarm kurma hatası:', err);
            setFormError(err.response?.data?.error || 'Alarm oluşturulurken bir hata meydana geldi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Alert
    const handleDeleteAlert = async (id: number) => {
        setIsDeleting(true);
        try {
            await api.delete(`/alerts/${id}`);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
            setDeleteModalId(null);
        } catch (err) {
            console.error('Alarm silinirken hata:', err);
            alert('Alarm silinirken bir hata oluştu.');
        } finally {
            setIsDeleting(false);
        }
    };

    const resetModal = () => {
        setSelectedAsset(null);
        setModalSymbolSearch('');
        setSearchResults([]);
        setTargetPriceInput('');
        setDirection('ABOVE');
        setFormError('');
    };

    // Stats
    const totalCount = alerts.length;
    const pendingCount = alerts.filter((a) => !a.isTriggered).length;
    const triggeredCount = alerts.filter((a) => a.isTriggered).length;

    // Filtered list
    const filteredAlerts = useMemo(() => {
        return alerts.filter((a) => {
            const matchesTab =
                filterTab === 'ALL' ? true : filterTab === 'PENDING' ? !a.isTriggered : a.isTriggered;
            const matchesSearch =
                searchQuery.trim() === '' ||
                a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.assetName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [alerts, filterTab, searchQuery]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* ÜST BAŞLIK ALANI */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                            <BellRing className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                Fiyat Alarmları
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                Hisseleriniz belirlediğiniz hedef fiyat seviyesine ulaştığında anında haberdar olun.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAlerts(true)}
                        disabled={refreshing}
                        className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        title="Yenile"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
                        <span className="hidden sm:inline">Yenile</span>
                    </button>
                    <button
                        onClick={() => {
                            resetModal();
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Yeni Alarm Kur</span>
                    </button>
                </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
                <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Toplam Alarm
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                            <Bell className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-foreground">{totalCount}</span>
                        <span className="text-xs text-slate-400">kayıtlı</span>
                    </div>
                </div>

                <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Bekleyen Alarmlar
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-amber-400">{pendingCount}</span>
                        <span className="text-xs text-slate-400">hedef bekleniyor</span>
                    </div>
                </div>

                <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Tetiklenenler
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-400">{triggeredCount}</span>
                        <span className="text-xs text-slate-400">hedefe ulaştı</span>
                    </div>
                </div>
            </div>

            {/* FİLTRE VE ARAMA ÇUBUĞU */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center p-1 bg-surface/70 border border-white/5 rounded-xl self-start">
                    <button
                        onClick={() => setFilterTab('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            filterTab === 'ALL'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Tümü ({totalCount})
                    </button>
                    <button
                        onClick={() => setFilterTab('PENDING')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            filterTab === 'PENDING'
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Aktif Bekleyenler ({pendingCount})
                    </button>
                    <button
                        onClick={() => setFilterTab('TRIGGERED')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            filterTab === 'TRIGGERED'
                                ? 'bg-emerald-500 text-black shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Tetiklenenler ({triggeredCount})
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Sembol veya varlık ara..."
                        className="w-full bg-surface/70 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-slate-500 focus:outline-none focus:border-primary transition"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ALARMLAR LİSTESİ */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className="h-44 rounded-2xl bg-surface/40 border border-white/5 animate-pulse"
                        />
                    ))}
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="bg-surface/30 border border-dashed border-white/10 rounded-3xl p-12 text-center max-w-xl mx-auto my-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                        <Bell className="w-8 h-8 opacity-60" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                        {searchQuery ? 'Aramanıza uygun alarm bulunamadı' : 'Henüz bir fiyat alarmı kurmadınız'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                        {searchQuery
                            ? `"${searchQuery}" kriterine uyan bir alarm yok. Aramayı sıfırlayabilirsiniz.`
                            : 'Hisseleriniz istediğiniz fiyata ulaştığında anında bildirim almak için hemen ilk alarmınızı kurun.'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => {
                                resetModal();
                                setIsModalOpen(true);
                            }}
                            className="mt-6 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" />
                            İlk Alarmı Oluştur
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filteredAlerts.map((alert) => {
                            const isAbove = alert.direction === 'ABOVE';
                            let distanceText = '—';
                            let isReached = false;

                            if (alert.currentPrice > 0) {
                                if (isAbove) {
                                    if (alert.targetPrice <= alert.currentPrice) {
                                        distanceText = 'Hedefe ulaşıldı';
                                        isReached = true;
                                    } else {
                                        const diff = ((alert.targetPrice - alert.currentPrice) / alert.currentPrice) * 100;
                                        distanceText = `+${diff.toFixed(2)}% kaldı`;
                                    }
                                } else {
                                    if (alert.targetPrice >= alert.currentPrice) {
                                        distanceText = 'Hedefe ulaşıldı';
                                        isReached = true;
                                    } else {
                                        const diff = ((alert.currentPrice - alert.targetPrice) / alert.currentPrice) * 100;
                                        distanceText = `-%${diff.toFixed(2)} kaldı`;
                                    }
                                }
                            }

                            return (
                                <motion.div
                                    key={alert.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className={`relative bg-surface/60 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:border-white/20 ${
                                        alert.isTriggered
                                            ? 'border-emerald-500/30 bg-emerald-950/10'
                                            : 'border-white/5'
                                    }`}
                                >
                                    {/* KART ÜST KISMI */}
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/assets/${encodeURIComponent(alert.symbol)}`}
                                                        className="text-base font-black text-foreground hover:text-primary transition flex items-center gap-1 group"
                                                    >
                                                        {alert.symbol}
                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-primary" />
                                                    </Link>
                                                    <span
                                                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 ${
                                                            isAbove
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}
                                                    >
                                                        {isAbove ? (
                                                            <>
                                                                <ArrowUpRight className="w-3 h-3" /> Fiyat Yükselirse
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ArrowDownRight className="w-3 h-3" /> Fiyat Düşerse
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                                                    {alert.assetName}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => setDeleteModalId(alert.id)}
                                                className="w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center cursor-pointer"
                                                title="Alarmı Sil"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* FİYAT BİLGİLERİ */}
                                        <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                            <div>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                                                    Anlık Fiyat
                                                </span>
                                                <span className="text-sm font-bold text-foreground mt-0.5 block">
                                                    {alert.currentPrice > 0
                                                        ? formatMoney(alert.currentPrice)
                                                        : '— ₺'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                                                    Hedef Fiyat
                                                </span>
                                                <span
                                                    className={`text-sm font-bold mt-0.5 block ${
                                                        isAbove ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}
                                                >
                                                    {formatMoney(alert.targetPrice)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KART ALT KISMI (DURUM) */}
                                    <div className="pt-2 border-t border-white/5">
                                        {alert.isTriggered ? (
                                            <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    <span>Hedefe Ulaştı!</span>
                                                </div>
                                                {alert.triggeredAt && (
                                                    <span className="text-[10px] text-emerald-400/80">
                                                        {formatDate(alert.triggeredAt)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                                    Hedefe Mesafe:
                                                </span>
                                                <span
                                                    className={`font-black ${
                                                        isReached
                                                            ? 'text-emerald-400'
                                                            : 'text-amber-400'
                                                    }`}
                                                >
                                                    {distanceText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* YENİ ALARM KURMA MODALI */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
                        >
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    resetModal();
                                }}
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
                                {/* VARLIK SEÇİMİ */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 block mb-2">
                                        Varlık (Hisse / Fon)
                                    </label>
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

                                    {/* Arama Sonuçları Açılır Menüsü */}
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
                                                        <span className="text-xs font-black text-white mr-2">
                                                            {res.symbol}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 truncate">
                                                            {res.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-primary">
                                                        {res.price > 0 ? `${res.price.toFixed(2)} ₺` : ''}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Seçilen Varlık Rozeti */}
                                    {selectedAsset && (
                                        <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black text-primary mr-2">
                                                    {selectedAsset.symbol}
                                                </span>
                                                <span className="text-[11px] text-slate-300">
                                                    {selectedAsset.name}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-foreground">
                                                Anlık: {selectedAsset.price > 0 ? formatMoney(selectedAsset.price) : '— ₺'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* YÖN SEÇİMİ */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 block mb-2">
                                        Alarm Koşulu
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDirection('ABOVE');
                                                setFormError('');
                                                if (selectedAsset && selectedAsset.price > 0) {
                                                    const parsed = parseFloat(targetPriceInput.replace(',', '.').trim());
                                                    if (isNaN(parsed) || parsed <= selectedAsset.price) {
                                                        setTargetPriceInput((selectedAsset.price * 1.05).toFixed(2));
                                                    }
                                                }
                                            }}
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
                                            <span className="text-[10px] opacity-80">Hedef fiyatın üzerine çıkınca</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDirection('BELOW');
                                                setFormError('');
                                                if (selectedAsset && selectedAsset.price > 0) {
                                                    const parsed = parseFloat(targetPriceInput.replace(',', '.').trim());
                                                    if (isNaN(parsed) || parsed >= selectedAsset.price) {
                                                        setTargetPriceInput((selectedAsset.price * 0.95).toFixed(2));
                                                    }
                                                }
                                            }}
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
                                            <span className="text-[10px] opacity-80">Hedef fiyatın altına inince</span>
                                        </button>
                                    </div>
                                </div>

                                {/* HEDEF FİYAT GİRİŞİ */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 block mb-2">
                                        Hedef Fiyat (₺)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={targetPriceInput}
                                            onChange={(e) => handlePriceInputChange(e.target.value)}
                                            placeholder="Örn: 350.50"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:border-primary font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            required
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                            ₺
                                        </span>
                                    </div>

                                    {/* Canlı Değişim / Uyumsuzluk Bilgisi */}
                                    {selectedAsset && selectedAsset.price > 0 && targetPriceInput && (() => {
                                        const clean = targetPriceInput.replace(',', '.').trim();
                                        const parsed = parseFloat(clean);
                                        if (isNaN(parsed) || parsed <= 0) return null;
                                        const diffPct = ((parsed - selectedAsset.price) / selectedAsset.price) * 100;
                                        const isMismatch = (direction === 'ABOVE' && parsed < selectedAsset.price) ||
                                                           (direction === 'BELOW' && parsed > selectedAsset.price);
                                        if (isMismatch) {
                                            return (
                                                <p className="text-[11px] font-semibold text-rose-400 mt-1.5 flex items-center gap-1">
                                                    ⚠️ {direction === 'ABOVE'
                                                        ? `Hedef fiyat (${formatMoney(parsed)}), anlık fiyattan (${formatMoney(selectedAsset.price)}) yüksek olmalıdır.`
                                                        : `Hedef fiyat (${formatMoney(parsed)}), anlık fiyattan (${formatMoney(selectedAsset.price)}) düşük olmalıdır.`}
                                                </p>
                                            );
                                        }
                                        return (
                                            <p className="text-[11px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
                                                <span>Anlık fiyata göre:</span>
                                                <span className={`font-bold ${diffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {diffPct >= 0 ? `+${diffPct.toFixed(2)}%` : `${diffPct.toFixed(2)}%`}
                                                </span>
                                            </p>
                                        );
                                    })()}

                                    {/* Hızlı Yüzde Butonları */}
                                    {selectedAsset && selectedAsset.price > 0 && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-slate-500 font-medium">Hızlı:</span>
                                            {(direction === 'ABOVE' ? [2, 5, 10, 15] : [-2, -5, -10, -15]).map(
                                                (pct) => (
                                                    <button
                                                        key={pct}
                                                        type="button"
                                                        onClick={() => handleQuickPercent(pct)}
                                                        className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer border border-white/5"
                                                    >
                                                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                                                    </button>
                                                )
                                            )}
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
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            resetModal();
                                        }}
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
                )}
            </AnimatePresence>

            {/* SİLME ONAY MODALI */}
            <AnimatePresence>
                {deleteModalId !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
                        >
                            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h4 className="text-base font-bold text-foreground">Fiyat Alarmını Sil</h4>
                            <p className="text-xs text-slate-400 mt-2">
                                Bu alarmı kaldırmak istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </p>
                            <div className="flex items-center justify-center gap-3 mt-6">
                                <button
                                    onClick={() => setDeleteModalId(null)}
                                    className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white transition text-xs font-semibold cursor-pointer"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={() => deleteModalId && handleDeleteAlert(deleteModalId)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function AlertsPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Yükleniyor...</span>
                </div>
            }
        >
            <AlertsContent />
        </Suspense>
    );
}
