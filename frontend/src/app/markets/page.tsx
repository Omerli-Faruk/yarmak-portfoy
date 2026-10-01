'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
    TrendingUp,
    TrendingDown,
    Flame,
    Search,
    Plus,
    Activity,
    Layers,
    RefreshCw,
    X,
    CheckCircle2,
    Clock,
    ShieldAlert
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface MarketIndexItem {
    symbol: string;
    name: string;
    price: number;
    change: string;
    positive: boolean;
}

interface MarketAssetItem {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    price: number;
    change: string;
    change_value: number;
    positive: boolean;
}

export default function MarketsPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [indices, setIndices] = useState<MarketIndexItem[]>([]);
    const [topGainers, setTopGainers] = useState<MarketAssetItem[]>([]);
    const [topLosers, setTopLosers] = useState<MarketAssetItem[]>([]);
    const [mostActive, setMostActive] = useState<MarketAssetItem[]>([]);
    const [screenerItems, setScreenerItems] = useState<MarketAssetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filtreler
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'HISSE' | 'FON' | 'EMTIA'>('ALL');
    const [selectedSort, setSelectedSort] = useState<'gainers' | 'losers' | 'popular' | 'alpha'>('gainers');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [totalFound, setTotalFound] = useState<number | null>(null);

    // Arama kutusuna hızlı yazarken sunucuyu boğmamak ve yarış durumunu (race condition) önlemek için 200ms debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Hızlı İşlem Ekleme Modalı State'i
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAssetForTx, setSelectedAssetForTx] = useState<MarketAssetItem | null>(null);
    const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState('');
    const [txCommission, setTxCommission] = useState('0');
    const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [isSubmittingTx, setIsSubmittingTx] = useState(false);
    const [txSuccessMessage, setTxSuccessMessage] = useState<string | null>(null);

    const fetchMarketData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const url = `/api/markets?category=${selectedCategory}&sort=${selectedSort}&search=${encodeURIComponent(debouncedSearch)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setIndices(data.indices || []);
                setTopGainers(data.topGainers || []);
                setTopLosers(data.topLosers || []);
                setMostActive(data.mostActive || []);
                setScreenerItems(data.screener || []);
                setTotalFound(typeof data.totalCount === 'number' ? data.totalCount : (data.screener?.length || 0));
            }
        } catch (err) {
            console.error('Piyasa verisi çekme hatası:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedCategory, selectedSort, debouncedSearch]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchMarketData();
    }, [fetchMarketData]);

    const handleOpenQuickModal = (asset: MarketAssetItem) => {
        if (!user) {
            router.push('/login');
            return;
        }
        setSelectedAssetForTx(asset);
        setTxPrice(asset.price > 0 ? (asset.price >= 100 ? asset.price.toFixed(2) : asset.price.toFixed(4)) : '');
        setTxAmount('');
        setTxCommission('0');
        setTxDate(new Date().toISOString().slice(0, 16));
        setTxType('BUY');
        setTxSuccessMessage(null);
        setIsModalOpen(true);
    };

    const handleSaveTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAssetForTx) return;

        if (new Date(txDate).getTime() > Date.now() + 60000) {
            alert('Gelecek tarihli işlem kaydedilemez.');
            return;
        }

        try {
            setIsSubmittingTx(true);
            const payload = {
                symbol: selectedAssetForTx.symbol,
                asset_type: selectedAssetForTx.asset_type,
                type: txType,
                amount: txAmount,
                price: txPrice,
                commission: txCommission,
                transaction_date: new Date(txDate).toISOString(),
            };

            await api.post('/transactions', payload);
            setTxSuccessMessage(`${selectedAssetForTx.symbol} işlemi başarıyla portföyünüze eklendi!`);
            setTimeout(() => {
                setIsModalOpen(false);
                setTxSuccessMessage(null);
            }, 1500);
        } catch (error: unknown) {
            const e = error as { response?: { data?: { error?: string } } };
            alert(e.response?.data?.error || 'İşlem eklenirken hata oluştu');
        } finally {
            setIsSubmittingTx(false);
        }
    };

    const formatMoney = (amount: number) => {
        const decimals = amount < 1 ? (amount < 0.01 ? 6 : 4) : 2;
        return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ₺`;
    };

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* 1. ÜST BAŞLIK & YENİLE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <Activity className="size-6 text-[#1A9FD3]" />
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Piyasalar & Varlık Keşfi
                            </h1>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-2xl">
                            Borsa İstanbul hisseleri, TEFAS yatırım fonları, altın ve döviz piyasalarında günün öne çıkanlarını ve en çok kazandıranlarını keşfedin.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/disclaimer"
                            title="Borsa İstanbul pay piyasası verileri en az 15 dakika gecikmelidir. Yatırım tavsiyesi değildir."
                            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                        >
                            <Clock className="size-3.5 text-amber-400" />
                            <span>BIST 15 Dk. Gecikmeli</span>
                        </Link>
                        <button
                            onClick={() => fetchMarketData(true)}
                            disabled={refreshing}
                            className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin text-[#1A9FD3]' : ''}`} />
                            <span>{refreshing ? 'Yenileniyor...' : 'Verileri Yenile'}</span>
                        </button>
                    </div>
                </div>

                {/* 2. CANLI PİYASA NABZI (ENDEKSLER) */}
                <div>
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity className="size-3.5 text-[#1A9FD3]" />
                        Canlı Piyasa Nabzı
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {indices.map(idx => {
                            const isPositive = idx.positive;
                            return (
                                <div
                                    key={idx.symbol}
                                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition shadow-xs"
                                >
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                        <span className="font-bold text-slate-300 font-mono">{idx.symbol}</span>
                                        <span className="truncate ml-2 text-[11px] text-slate-500">{idx.name}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                                            {idx.symbol === 'XU100' || idx.symbol === 'XU030'
                                                ? idx.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
                                                : formatMoney(idx.price)}
                                        </span>
                                        <span
                                            className={`text-xs font-bold font-mono flex items-center tabular-nums ${
                                                isPositive ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                        >
                                            {isPositive ? (
                                                <TrendingUp className="size-3 mr-0.5" />
                                            ) : (
                                                <TrendingDown className="size-3 mr-0.5" />
                                            )}
                                            {idx.change}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. PİYASA LİDERLERİ: 3 KOLONLU KART GRUBU */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* KOLON 1: GÜNÜN EN ÇOK YÜKSELENLERİ */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                                    <TrendingUp className="size-4" />
                                </div>
                                <h3 className="font-bold text-white text-sm">Günün Yükselenleri</h3>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">En çok artanlar</span>
                        </div>

                        <div className="space-y-2 flex-1">
                            {topGainers.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Yükselen varlık verisi yükleniyor...</p>
                            ) : (
                                topGainers.map((item, idx) => (
                                    <div
                                        key={`gain-${item.id}-${item.symbol}-${idx}`}
                                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700/50"
                                    >
                                        <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                                {item.symbol.slice(0, 2)}
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-white group-hover:text-[#1A9FD3] transition font-mono">
                                                        {item.symbol}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                                                        {item.asset_type}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate">{item.name}</p>
                                            </div>
                                        </Link>

                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <div className="text-right">
                                                <div className="text-xs font-semibold text-slate-200 tabular-nums">
                                                    {formatMoney(item.price)}
                                                </div>
                                                <div className="text-[11px] font-bold text-emerald-400 font-mono tabular-nums">
                                                    {item.change}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleOpenQuickModal(item)}
                                                title="Portföyüme Ekle"
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#1A9FD3] text-slate-300 hover:text-white transition cursor-pointer"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* KOLON 2: GÜNÜN EN ÇOK DÜŞENLERİ */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                                    <TrendingDown className="size-4" />
                                </div>
                                <h3 className="font-bold text-white text-sm">Günün Düşenleri</h3>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">Fırsat arayanlar</span>
                        </div>

                        <div className="space-y-2 flex-1">
                            {topLosers.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Düşen varlık verisi yükleniyor...</p>
                            ) : (
                                topLosers.map((item, idx) => (
                                    <div
                                        key={`loss-${item.id}-${item.symbol}-${idx}`}
                                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700/50"
                                    >
                                        <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                                {item.symbol.slice(0, 2)}
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-white group-hover:text-[#1A9FD3] transition font-mono">
                                                        {item.symbol}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                                                        {item.asset_type}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate">{item.name}</p>
                                            </div>
                                        </Link>

                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <div className="text-right">
                                                <div className="text-xs font-semibold text-slate-200 tabular-nums">
                                                    {formatMoney(item.price)}
                                                </div>
                                                <div className="text-[11px] font-bold text-rose-400 font-mono tabular-nums">
                                                    {item.change}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleOpenQuickModal(item)}
                                                title="Portföyüme Ekle"
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#1A9FD3] text-slate-300 hover:text-white transition cursor-pointer"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* KOLON 3: GÜNÜN POPÜLER & LİKİT VARLIKLARI */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                                    <Flame className="size-4" />
                                </div>
                                <h3 className="font-bold text-white text-sm">Popüler & Lokomotifler</h3>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">En çok takip edilen</span>
                        </div>

                        <div className="space-y-2 flex-1">
                            {mostActive.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Popüler varlıklar yükleniyor...</p>
                            ) : (
                                mostActive.map((item, idx) => (
                                    <div
                                        key={`pop-${item.id}-${item.symbol}-${idx}`}
                                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700/50"
                                    >
                                        <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                                {item.symbol.slice(0, 2)}
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-white group-hover:text-[#1A9FD3] transition font-mono">
                                                        {item.symbol}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                                                        {item.asset_type}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate">{item.name}</p>
                                            </div>
                                        </Link>

                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <div className="text-right">
                                                <div className="text-xs font-semibold text-slate-200 tabular-nums">
                                                    {formatMoney(item.price)}
                                                </div>
                                                <div className={`text-[11px] font-bold font-mono tabular-nums ${item.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {item.change}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleOpenQuickModal(item)}
                                                title="Portföyüme Ekle"
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#1A9FD3] text-slate-300 hover:text-white transition cursor-pointer"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. GELİŞMİŞ VARLIK KEŞFİ & FİLTRELEME ALANI (SCREENER) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
                    
                    {/* Üst Başlık & Arama Çubuğu */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Layers className="size-5 text-slate-400" />
                                Varlık Keşif Listesi
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Kriterlerinize göre hisse ve fonları filtreleyin, anında portföyünüze ekleyin.
                            </p>
                        </div>

                        {/* Canlı Arama Inputu */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Hisse, fon veya sembol ara..."
                                className="w-full bg-slate-800/90 border border-slate-700/70 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filtre Butonları (Kategori + Sıralama) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                        {/* Kategori Sekmeleri */}
                        <div className="flex items-center gap-1.5 bg-slate-800/70 p-1 rounded-xl border border-slate-700/60 overflow-x-auto no-scrollbar">
                            {([
                                { id: 'ALL' as const, label: 'Tümü' },
                                { id: 'HISSE' as const, label: 'BIST Hisseleri' },
                                { id: 'FON' as const, label: 'TEFAS Fonları' },
                                { id: 'EMTIA' as const, label: 'Altın & Döviz' },
                            ]).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                                        selectedCategory === cat.id
                                            ? 'bg-[#1A9FD3] text-white shadow-xs'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                            {/* Sıralama Seçenekleri */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Sırala:</span>
                                <div className="flex items-center gap-1 bg-slate-800/70 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold">
                                    {([
                                        { id: 'gainers' as const, label: 'En Çok Artanlar' },
                                        { id: 'losers' as const, label: 'En Çok Düşenler' },
                                        { id: 'popular' as const, label: 'Popülerler' },
                                        { id: 'alpha' as const, label: 'A-Z' },
                                    ]).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedSort(s.id)}
                                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                                                selectedSort === s.id
                                                    ? 'bg-slate-700 text-white font-bold'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Arama Geribildirim Çubuğu */}
                    {debouncedSearch && totalFound !== null && (
                        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/60">
                            <div className="flex items-center gap-2">
                                <Search className="size-3.5 text-[#1A9FD3]" />
                                <span>
                                    <strong>&quot;{debouncedSearch}&quot;</strong> için <strong>{totalFound}</strong> varlık bulundu
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                                En alakalılar üstte, benzer varlıklar aşağıda listelenir
                            </span>
                        </div>
                    )}

                    {/* Varlık Tablosu */}
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                            <LoadingSpinner fullScreen={false} message="Piyasa varlıkları yükleniyor..." />
                        </div>
                    ) : screenerItems.length === 0 ? (
                        <div className="py-16 text-center text-slate-500">
                            <Activity className="size-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-medium">
                                {debouncedSearch ? `"${debouncedSearch}" aramasına uygun veya benzer varlık bulunamadı.` : 'Aramanıza uygun varlık bulunamadı.'}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">Farklı bir sembol veya arama terimi deneyebilirsiniz.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-horizontal-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                        <th className="py-3 px-3">Varlık</th>
                                        <th className="py-3 px-3">Tür</th>
                                        <th className="py-3 px-3 text-right">Fiyat</th>
                                        <th className="py-3 px-3 text-right">Günlük Değişim</th>
                                        <th className="py-3 px-3 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-medium">
                                    {screenerItems.map((item, idx) => (
                                        <tr key={`scr-${item.id}-${item.symbol}-${idx}`} className="hover:bg-slate-800/30 transition group">
                                            <td className="py-3 px-3">
                                                <Link href={`/assets/${item.symbol}`} className="flex items-center gap-2.5 hover:text-[#1A9FD3] transition">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0 group-hover:bg-[#1A9FD3] transition">
                                                        {item.symbol.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-white group-hover:text-[#1A9FD3] transition font-mono">
                                                            {item.symbol}
                                                        </span>
                                                        <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                                                            {item.name}
                                                        </p>
                                                    </div>
                                                </Link>
                                            </td>

                                            <td className="py-3 px-3">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                                    {item.asset_type}
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-right font-bold text-slate-200 tabular-nums font-mono">
                                                {formatMoney(item.price)}
                                            </td>

                                            <td className="py-3 px-3 text-right">
                                                <span className={`inline-flex items-center font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
                                                    item.positive
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-rose-500/10 text-rose-400'
                                                }`}>
                                                    {item.positive ? '+' : ''}
                                                    {item.change_value.toFixed(2)}%
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Link
                                                        href={`/assets/${item.symbol}`}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-semibold text-[11px]"
                                                    >
                                                        Detay
                                                    </Link>
                                                    <button
                                                        onClick={() => handleOpenQuickModal(item)}
                                                        className="px-2.5 py-1 rounded-lg bg-[#1A9FD3]/20 hover:bg-[#1A9FD3] text-[#1A9FD3] hover:text-white border border-[#1A9FD3]/30 transition font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Plus className="size-3 stroke-[3]" />
                                                        <span>Ekle</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. YASAL ÇEKİNCE & SPK BİLGİLENDİRME BANNERI */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                            <ShieldAlert className="size-4" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="font-semibold text-slate-200">
                                BIST Verileri 15 Dakika Gecikmelidir &bull; Yatırım Tavsiyesi Değildir
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Piyasa verileri ve fiyatlar genel bilgilendirme amaçlıdır; anlık aracı kurum emir fiyatlarınızdan veya gerçekleşen işlemlerinizden farklılık gösterebilir.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/disclaimer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold shrink-0 transition"
                    >
                        <span>Detaylı Yasal Uyarı</span>
                        <span>&rarr;</span>
                    </Link>
                </div>
            </div>

            {/* HIZLI İŞLEM EKLEME MODALI */}
            {isModalOpen && selectedAssetForTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[#1A9FD3] flex items-center justify-center font-bold text-white text-xs">
                                    {selectedAssetForTx.symbol.slice(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                                        {selectedAssetForTx.symbol}
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                                            {selectedAssetForTx.asset_type}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 truncate max-w-xs">{selectedAssetForTx.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Modal İçerik / Form */}
                        <form onSubmit={handleSaveTransaction} className="p-5 space-y-4">
                            {txSuccessMessage ? (
                                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                                    <CheckCircle2 className="size-12 text-emerald-400 animate-bounce" />
                                    <p className="text-sm font-bold text-white">{txSuccessMessage}</p>
                                    <p className="text-xs text-slate-400">Pencere otomatik kapatılıyor...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Alış / Satış Seçimi */}
                                    <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setTxType('BUY')}
                                            className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                                txType === 'BUY'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <TrendingUp className="size-3.5" />
                                            <span>ALIŞ (BUY)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTxType('SELL')}
                                            className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                                txType === 'SELL'
                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <TrendingDown className="size-3.5" />
                                            <span>SATIŞ (SELL)</span>
                                        </button>
                                    </div>

                                    {/* Miktar (Lot) & Birim Fiyat */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-1">
                                                Adet / Lot
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                min="0.000001"
                                                value={txAmount}
                                                onChange={e => setTxAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#1A9FD3]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-1">
                                                Birim Fiyat (₺)
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                min="0.0001"
                                                value={txPrice}
                                                onChange={e => setTxPrice(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#1A9FD3]"
                                            />
                                        </div>
                                    </div>

                                    {/* Komisyon & Tarih */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-1">
                                                Komisyon (₺)
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={txCommission}
                                                onChange={e => setTxCommission(e.target.value)}
                                                placeholder="0"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#1A9FD3]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-1">
                                                İşlem Tarihi
                                            </label>
                                            <input
                                                type="datetime-local"
                                                required
                                                value={txDate}
                                                onChange={e => setTxDate(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#1A9FD3]"
                                            />
                                        </div>
                                    </div>

                                    {/* Hesaplanan Toplam */}
                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-medium">Toplam Tutar:</span>
                                        <span className="font-bold text-white font-mono text-sm">
                                            {formatMoney(
                                                (parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0) +
                                                (parseFloat(txCommission) || 0)
                                            )}
                                        </span>
                                    </div>

                                    {/* Gönder Butonu */}
                                    <button
                                        type="submit"
                                        disabled={isSubmittingTx}
                                        className={`w-full py-2.5 rounded-xl font-bold text-xs text-white transition shadow-sm cursor-pointer disabled:opacity-50 ${
                                            txType === 'BUY'
                                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                                                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                                        }`}
                                    >
                                        {isSubmittingTx
                                            ? 'Kaydediliyor...'
                                            : `${selectedAssetForTx.symbol} İşlemini Portföyüme Ekle`}
                                    </button>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
