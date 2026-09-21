'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PortfolioSummary, UserHolding } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Briefcase,
    Layers,
    Plus,
    Search,
    SlidersHorizontal,
    FolderPlus,
    X,
    Check,
    Edit2,
    Trash2,
    ArrowUpRight,
    Tag,
    ChevronRight,
    ArrowLeft,
    RefreshCw,
    Clock
} from 'lucide-react';
import TransactionDatePicker from '@/components/TransactionDatePicker';

interface AssetGroup {
    id: string;
    name: string;
    color: string;
}

export default function HoldingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [holdings, setHoldings] = useState<UserHolding[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Para birimi seçimi: 'TRY' veya 'USD'
    const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');

    // Periyot Seçimi: 1D (Günlük), 1W, 1M, 3M, 1Y, ALL
    const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1D');

    // Her varlığın periyot getiri verileri (symbol -> { 1D: number, 1W: number, ... })
    const [assetSummaries, setAssetSummaries] = useState<Record<string, Record<string, number>>>({});

    // Gruplar ve Varlık-Grup Eşleşmeleri
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [assetGroups, setAssetGroups] = useState<Record<string, string[]>>({}); // symbol -> [groupId1, groupId2]

    // Aktif Seçili Sekme: 'all' | 'by_type' | groupId
    const [activeTab, setActiveTab] = useState<string>('all');

    // Arama ve Sıralama
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'pnl_desc' | 'pnl_asc' | 'val_desc' | 'name_asc' | 'amount_desc'>('val_desc');

    // Modal Durumları
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#6366f1');

    const [assigningAsset, setAssigningAsset] = useState<UserHolding | null>(null);

    // İşlem Ekleme Modal'ı
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [txSymbol, setTxSymbol] = useState('');
    const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
    const [txAmount, setTxAmount] = useState('');
    const [txPrice, setTxPrice] = useState('');
    const [txDate, setTxDate] = useState(new Date().toISOString());
    const [txCommission, setTxCommission] = useState('0');
    const [isTxDateError, setIsTxDateError] = useState(false);
    const [txSubmitting, setTxSubmitting] = useState(false);

    const availableColors = [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#8b5cf6', // Purple
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#ef4444', // Red
    ];

    // Para birimi ve grupları localStorage'dan yükle
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedCurr = localStorage.getItem('preferred_currency');
            if (savedCurr === 'USD' || savedCurr === 'TRY') {
                setCurrency(savedCurr);
            }

            const userId = user?.id || 'default';
            const savedGroups = localStorage.getItem(`user_groups_${userId}`);
            const savedAssetGroups = localStorage.getItem(`asset_groups_${userId}`);

            if (savedGroups) {
                try {
                    setGroups(JSON.parse(savedGroups));
                } catch (e) {
                    console.error('Grup ayrıştırma hatası:', e);
                }
            } else {
                // Başlangıç varsayılan grupları
                const defaultGroups: AssetGroup[] = [
                    { id: 'g_temettu', name: 'Temettü Hisselerim', color: '#10b981' },
                    { id: 'g_buyume', name: 'Büyüme Portföyü', color: '#6366f1' },
                    { id: 'g_uzun', name: 'Uzun Vade', color: '#f59e0b' },
                ];
                setGroups(defaultGroups);
                localStorage.setItem(`user_groups_${userId}`, JSON.stringify(defaultGroups));
            }

            if (savedAssetGroups) {
                try {
                    setAssetGroups(JSON.parse(savedAssetGroups));
                } catch (e) {
                    console.error('Varlık grup ayrıştırma hatası:', e);
                }
            }
        }
    }, [user]);

    // Grupları kaydet
    const saveGroups = (newGroups: AssetGroup[], newAssetGroups: Record<string, string[]>) => {
        setGroups(newGroups);
        setAssetGroups(newAssetGroups);
        if (typeof window !== 'undefined') {
            const userId = user?.id || 'default';
            localStorage.setItem(`user_groups_${userId}`, JSON.stringify(newGroups));
            localStorage.setItem(`asset_groups_${userId}`, JSON.stringify(newAssetGroups));
        }
    };

    const toggleCurrency = () => {
        const next = currency === 'TRY' ? 'USD' : 'TRY';
        setCurrency(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferred_currency', next);
        }
    };

    const loadData = async () => {
        try {
            setRefreshing(true);
            const [sumRes, holdRes] = await Promise.all([
                api.get<PortfolioSummary>('/portfolio/summary').catch(() => null),
                api.get<UserHolding[]>('/portfolio/holdings').catch(() => null),
            ]);

            if (sumRes?.data) setSummary(sumRes.data);
            if (holdRes?.data) {
                const holds = holdRes.data;
                setHoldings(holds);

                // Her varlığın periyot getirilerini arka planda detay API'sinden çek
                holds.forEach(async h => {
                    try {
                        const detRes = await fetch(`/api/assets/detail?symbol=${h.symbol}&range=1D`);
                        if (detRes.ok) {
                            const det = await detRes.json();
                            if (det.summary) {
                                setAssetSummaries(prev => ({
                                    ...prev,
                                    [h.symbol]: det.summary,
                                }));
                            }
                        }
                    } catch {
                        // sessizce geç
                    }
                });
            }
        } catch (err) {
            console.error('Varlıklar yüklenirken hata:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            loadData();
        }
    }, [user, authLoading]);

    const usdRate = summary?.usd_rate && summary.usd_rate > 0 ? summary.usd_rate : 48.65;

    // Para formatlayıcı
    const fmt = (amountTRY: number): string => {
        if (isNaN(amountTRY)) amountTRY = 0;
        if (currency === 'USD') {
            const valUSD = amountTRY / usdRate;
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(valUSD);
        }
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amountTRY);
    };

    // Yeni Grup Oluştur
    const handleCreateGroup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        const newGroup: AssetGroup = {
            id: 'grp_' + Date.now(),
            name: newGroupName.trim(),
            color: newGroupColor,
        };
        const updated = [...groups, newGroup];
        saveGroups(updated, assetGroups);
        setNewGroupName('');
        setIsCreateGroupOpen(false);
        setActiveTab(newGroup.id);
    };

    // Grubu Sil
    const handleDeleteGroup = (groupId: string) => {
        if (!confirm('Bu grubu silmek istediğinize emin misiniz? (Hisseleriniz silinmez)')) return;
        const updatedGroups = groups.filter(g => g.id !== groupId);
        const updatedAssetGroups = { ...assetGroups };
        Object.keys(updatedAssetGroups).forEach(sym => {
            updatedAssetGroups[sym] = updatedAssetGroups[sym].filter(id => id !== groupId);
        });
        saveGroups(updatedGroups, updatedAssetGroups);
        if (activeTab === groupId) setActiveTab('all');
    };

    // Hisseyi Gruba Ekle / Çıkar
    const toggleAssetInGroup = (symbol: string, groupId: string) => {
        const currentGroups = assetGroups[symbol] || [];
        let updated: string[];
        if (currentGroups.includes(groupId)) {
            updated = currentGroups.filter(id => id !== groupId);
        } else {
            updated = [...currentGroups, groupId];
        }
        const updatedAssetGroups = { ...assetGroups, [symbol]: updated };
        saveGroups(groups, updatedAssetGroups);
    };

    // Hızlı İşlem Kaydet (Al / Sat)
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
            setIsTxModalOpen(false);
            setTxAmount('');
            setTxPrice('');
            setTxCommission('0');
            setTxDate(new Date().toISOString());
            await loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'İşlem eklenirken hata oluştu');
        } finally {
            setTxSubmitting(false);
        }
    };

    // Filtrelenmiş ve Sıralanmış Varlıklar
    const processedHoldings = useMemo(() => {
        let list = [...holdings];

        // 1. Sekme Filtresi
        if (activeTab !== 'all' && activeTab !== 'by_type') {
            // Özel grup seçili
            list = list.filter(h => (assetGroups[h.symbol] || []).includes(activeTab));
        }

        // 2. Arama Filtresi
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(h => h.symbol.toLowerCase().includes(q) || h.asset_name.toLowerCase().includes(q));
        }

        // 3. Sıralama
        list.sort((a, b) => {
            const aVal = a.total_value;
            const bVal = b.total_value;
            const aCost = a.average_cost * a.total_amount;
            const bCost = b.average_cost * b.total_amount;
            const aPnlPct = aCost > 0 ? (a.profit_loss / aCost) * 100 : 0;
            const bPnlPct = bCost > 0 ? (b.profit_loss / bCost) * 100 : 0;

            if (sortBy === 'pnl_desc') return bPnlPct - aPnlPct;
            if (sortBy === 'pnl_asc') return aPnlPct - bPnlPct;
            if (sortBy === 'val_desc') return bVal - aVal;
            if (sortBy === 'name_asc') return a.symbol.localeCompare(b.symbol);
            if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
            return 0;
        });

        return list;
    }, [holdings, activeTab, assetGroups, searchQuery, sortBy]);

    // Seçili grubun istatistikleri
    const selectedGroupMeta = useMemo(() => {
        if (activeTab === 'all' || activeTab === 'by_type') return null;
        const grp = groups.find(g => g.id === activeTab);
        if (!grp) return null;

        const groupAssets = holdings.filter(h => (assetGroups[h.symbol] || []).includes(grp.id));
        const totalVal = groupAssets.reduce((sum, a) => sum + a.total_value, 0);
        const totalCost = groupAssets.reduce((sum, a) => sum + (a.average_cost * a.total_amount), 0);
        const totalPnl = totalVal - totalCost;
        const pnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        return {
            group: grp,
            assetCount: groupAssets.length,
            totalVal,
            totalCost,
            totalPnl,
            pnlPct,
        };
    }, [activeTab, groups, holdings, assetGroups]);

    if (authLoading || loading) {
        return <LoadingSpinner withLogo message="Varlıklarınız ve portföy grupları yükleniyor..." />;
    }

    const totalPortfolioVal = summary?.total_value || holdings.reduce((s, h) => s + h.total_value, 0);
    const totalPortfolioCost = summary?.total_cost || holdings.reduce((s, h) => s + (h.average_cost * h.total_amount), 0);
    const totalPortfolioPnl = totalPortfolioVal - totalPortfolioCost;
    const totalPortfolioPnlPct = totalPortfolioCost > 0 ? (totalPortfolioPnl / totalPortfolioCost) * 100 : 0;

    return (
        <div className="min-h-screen text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 1. ÜST BAR: BAŞLIK, PARA BİRİMİ TOGGLE, İŞLEM EKLE */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-sm">
                    <div>
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard" className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition" title="Dashboard'a Dön">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Varlıklarım & Gruplar
                            </h1>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            Sahip olduğunuz hisse, fon ve varlıkları dilediğiniz gibi gruplayın, sıralayın ve inceleyin.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* 🔘 TEK TIKLA PARA BİRİMİ DÖNÜŞTÜRÜCÜ (TRY ⇄ USD) */}
                        <button
                            onClick={toggleCurrency}
                            title="Tüm değerleri Dolar veya TL cinsinden görüntüle"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm border bg-slate-800 border-slate-700 hover:border-slate-600 active:scale-95 cursor-pointer text-white"
                        >
                            <span className="text-base">{currency === 'TRY' ? '🇹🇷' : '🇺🇸'}</span>
                            <span>Para Birimi:</span>
                            <span className={`px-2 py-0.5 rounded-md font-extrabold ${currency === 'TRY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {currency === 'TRY' ? '₺ TRY' : '$ USD'}
                            </span>
                        </button>

                        {/* Yeni İşlem Ekle */}
                        <button
                            onClick={() => {
                                setTxSymbol(holdings[0]?.symbol || 'ASELS');
                                setIsTxModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/20 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>İşlem Ekle</span>
                        </button>

                        {/* Yenile */}
                        <button
                            onClick={loadData}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
                            title="Yenile"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* 2. PERİYOT BUTONLARI & PORTFÖY TOPLAM ÖZETİ */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* PERİYOT SEÇİCİ: 1D, 1W, 1M, 3M, 1Y, ALL */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Getiri Dönemi:
                        </span>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 overflow-x-auto">
                            {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPeriod(p)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer shrink-0 ${
                                        selectedPeriod === p
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                                    }`}
                                >
                                    {p === '1D' ? 'Günlük (1D)' : p === '1W' ? 'Haftalık' : p === '1M' ? 'Aylık' : p === '3M' ? '3 Aylık' : p === '1Y' ? 'Yıllık' : 'Tümü'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Toplam Portföy Hızlı Göstergesi */}
                    <div className="flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                        <div>
                            <p className="text-[11px] text-slate-400">Toplam Portföy Değeri</p>
                            <p className="text-lg font-black text-white">{fmt(totalPortfolioVal)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-slate-400">Net Kâr / Zarar</p>
                            <p className={`text-lg font-black flex items-center justify-end ${totalPortfolioPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalPortfolioPnl >= 0 ? '+' : ''}{fmt(totalPortfolioPnl)}
                                <span className="text-xs font-bold ml-1.5 font-mono">
                                    ({totalPortfolioPnl >= 0 ? '+' : ''}{totalPortfolioPnlPct.toFixed(2)}%)
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. ÖZEL GRUP SEKMELERİ & YENİ GRUP OLUŞTURMA */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Gruplar & Listeler
                        </span>
                        <button
                            onClick={() => setIsCreateGroupOpen(true)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                        >
                            <FolderPlus className="w-3.5 h-3.5" />
                            <span>+ Yeni Grup Oluştur</span>
                        </button>
                    </div>

                    {/* Grup Butonları / Sekmeleri */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {/* 1. TÜMÜ */}
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                activeTab === 'all'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                        >
                            <span>Tüm Varlıklar</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] font-mono">
                                {holdings.length}
                            </span>
                        </button>

                        {/* 2. TÜRE GÖRE OTOMATİK GRUPLAMA */}
                        <button
                            onClick={() => setActiveTab('by_type')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                activeTab === 'by_type'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                        >
                            <span>Türe Göre Grupla</span>
                        </button>

                        {/* 3. KULLANICININ ÖZEL GRUPLARI */}
                        {groups.map(g => {
                            const count = holdings.filter(h => (assetGroups[h.symbol] || []).includes(g.id)).length;
                            return (
                                <button
                                    key={g.id}
                                    onClick={() => setActiveTab(g.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                        activeTab === g.id
                                            ? 'bg-slate-800 text-white border-2'
                                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                    }`}
                                    style={activeTab === g.id ? { borderColor: g.color } : {}}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }}></span>
                                    <span>{g.name}</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px] font-mono text-slate-300">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ÖZEL GRUP DETAY KARTI (Seçili grup varsa gösterilir) */}
                {selectedGroupMeta && (
                    <div className="bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: `${selectedGroupMeta.group.color}40` }}>
                        <div className="flex items-center gap-3">
                            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedGroupMeta.group.color }}></span>
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    {selectedGroupMeta.group.name}
                                    <span className="text-xs font-normal text-slate-400">({selectedGroupMeta.assetCount} Varlık)</span>
                                </h2>
                                <p className="text-xs text-slate-400">Bu gruba atanan varlıkların toplam performansı</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-[11px] text-slate-400">Grup Büyüklüğü</p>
                                <p className="text-base font-bold text-white">{fmt(selectedGroupMeta.totalVal)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400">Grup Kâr / Zarar</p>
                                <p className={`text-base font-bold flex items-center ${selectedGroupMeta.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {selectedGroupMeta.totalPnl >= 0 ? '+' : ''}{fmt(selectedGroupMeta.totalPnl)}
                                    <span className="text-xs ml-1 font-mono">({selectedGroupMeta.totalPnl >= 0 ? '+' : ''}{selectedGroupMeta.pnlPct.toFixed(2)}%)</span>
                                </p>
                            </div>
                            <button
                                onClick={() => handleDeleteGroup(selectedGroupMeta.group.id)}
                                className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer ml-2"
                                title="Grubu Sil"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. ARAMA VE SIRALAMA KONTROLLERİ */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    {/* Arama Kutusu */}
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Sembol veya hisse ara..."
                            className="w-full bg-slate-800/80 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                        />
                    </div>

                    {/* Sıralama Açılır Menüsü */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">Sırala:</span>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                        >
                            <option value="val_desc">En Yüksek Değer (Azalan)</option>
                            <option value="pnl_desc">En Çok Kazandıranlar (Kâr %)</option>
                            <option value="pnl_asc">En Çok Kaybettirenler (Zarar %)</option>
                            <option value="name_asc">Alfabetik (A-Z)</option>
                            <option value="amount_desc">Adet / Lot (Azalan)</option>
                        </select>
                    </div>
                </div>

                {/* 5. VARLIK LİSTESİ / KARTLARI */}
                {activeTab === 'by_type' ? (
                    // TÜRE GÖRE GRUPLANMIŞ GÖRÜNÜM
                    <div className="space-y-6">
                        {(['HISSE', 'FON', 'ALTIN', 'DOVIZ'] as const).map(typeKey => {
                            const typeList = processedHoldings.filter(h => h.asset_type === typeKey);
                            if (typeList.length === 0) return null;
                            const typeTitle = typeKey === 'HISSE' ? 'Hisse Senetleri' : typeKey === 'FON' ? 'Yatırım Fonları' : typeKey === 'ALTIN' ? 'Altın & Emtia' : 'Döviz';
                            const typeVal = typeList.reduce((s, h) => s + h.total_value, 0);

                            return (
                                <div key={typeKey} className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                            {typeTitle} ({typeList.length})
                                        </h3>
                                        <span className="text-xs font-bold text-slate-400">{fmt(typeVal)}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {typeList.map(h => renderAssetCard(h))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // NORMAL VEYA ÖZEL GRUP LİSTESİ
                    <div className="grid grid-cols-1 gap-3">
                        {processedHoldings.length > 0 ? (
                            processedHoldings.map(h => renderAssetCard(h))
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                                <p className="text-base font-semibold text-white mb-1">Bu grupta veya aramada varlık bulunamadı.</p>
                                <p className="text-xs text-slate-500 mb-4">
                                    {activeTab !== 'all' ? 'Aşağıdaki butona basarak hisselerinizi bu gruba dahil edebilirsiniz.' : 'Portföyünüze yeni hisse veya fon işlemi ekleyin.'}
                                </p>
                                {activeTab !== 'all' && (
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                                    >
                                        Tüm Varlıklara Git ve Gruba Ata
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 6. YENİ GRUP OLUŞTURMA MODALI */}
            {isCreateGroupOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FolderPlus className="w-5 h-5 text-indigo-400" />
                                Yeni Grup Oluştur
                            </h3>
                            <button onClick={() => setIsCreateGroupOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Grup Adı</label>
                                <input
                                    type="text"
                                    required
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    placeholder="örn. Temettü Portföyüm, Teknoloji, Uzun Vade"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2">Grup Rengi</label>
                                <div className="flex items-center gap-3">
                                    {availableColors.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewGroupColor(c)}
                                            className={`w-7 h-7 rounded-full transition flex items-center justify-center cursor-pointer ${
                                                newGroupColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-80 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: c }}
                                        >
                                            {newGroupColor === c && <Check className="w-4 h-4 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateGroupOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
                                >
                                    Grup Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 7. HİSSEYİ GRUPLARA ATAMA MODALI */}
            {assigningAsset && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-white">Gruplara Ata: {assigningAsset.symbol}</h3>
                                <p className="text-xs text-slate-400">{assigningAsset.asset_name}</p>
                            </div>
                            <button onClick={() => setAssigningAsset(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {groups.length > 0 ? (
                                groups.map(g => {
                                    const isAssigned = (assetGroups[assigningAsset.symbol] || []).includes(g.id);
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => toggleAssetInGroup(assigningAsset.symbol, g.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                                                isAssigned ? 'bg-indigo-600/10 border-indigo-500/40 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }}></span>
                                                <span className="text-xs font-bold text-slate-200">{g.name}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isAssigned ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700'}`}>
                                                {isAssigned && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-slate-500 text-center py-4">Henüz oluşturulmuş özel grup yok.</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                            <button
                                onClick={() => {
                                    setAssigningAsset(null);
                                    setIsCreateGroupOpen(true);
                                }}
                                className="text-xs font-bold text-indigo-400 hover:underline"
                            >
                                + Yeni Grup Ekle
                            </button>
                            <button
                                onClick={() => setAssigningAsset(null)}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
                            >
                                Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. HIZLI İŞLEM EKLEME MODALI */}
            {isTxModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white">İşlem Ekle</h3>
                            <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-white">
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTxType('BUY')}
                                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${txType === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    Alış (BUY)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTxType('SELL')}
                                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${txType === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    Satış (SELL)
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Adet (Lot)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.000001"
                                        required
                                        value={txAmount}
                                        onChange={e => setTxAmount(e.target.value)}
                                        placeholder="100"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                                    />
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                                    />
                                </div>
                            </div>

                            {/* 🗓️ GELİŞMİŞ ERGONOMİK TARİH VE SAAT SEÇİCİ */}
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                                />
                            </div>

                            {/* Toplam İşlem Tutarı Özeti */}
                            {parseFloat(txAmount) > 0 && parseFloat(txPrice) > 0 && (
                                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Toplam İşlem Tutarı:</span>
                                    <span className="font-bold text-white font-mono">
                                        {((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsTxModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={txSubmitting || isTxDateError}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
                                >
                                    {txSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    // Varlık Kartı Render Fonksiyonu
    function renderAssetCard(h: UserHolding) {
        const costVal = h.average_cost * h.total_amount;
        const pnl = h.profit_loss;
        const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0;
        const isPos = pnl >= 0;

        // Dönemsel Getiri
        const sum = assetSummaries[h.symbol];
        let periodRetVal: number | null = null;
        if (sum && sum[selectedPeriod] !== undefined) {
            periodRetVal = sum[selectedPeriod];
        } else if (selectedPeriod === 'ALL') {
            periodRetVal = pnlPct;
        }

        // Varlığın Atandığı Gruplar
        const assignedGroupIds = assetGroups[h.symbol] || [];
        const assignedGroupObjects = groups.filter(g => assignedGroupIds.includes(g.id));

        return (
            <div
                key={h.symbol}
                className="bg-slate-900 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
                {/* SOL: SEMBOL, ADI, DETAY SAYFASINA GİTME LİNKİ VE GRUP ROZETLERİ */}
                <div className="flex items-start gap-3.5">
                    <Link
                        href={`/assets/${h.symbol}`}
                        className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-white group-hover:border-indigo-500/50 group-hover:bg-indigo-950/30 transition shrink-0"
                        title="Detaylı Grafik ve Analiz İçin Tıklayın"
                    >
                        <span className="text-xs font-black font-mono tracking-tight text-indigo-400">
                            {h.symbol.slice(0, 4)}
                        </span>
                    </Link>

                    <div>
                        <div className="flex items-center gap-2">
                            {/* 🔗 KULLANICI İSTEĞİ: HİSSEYE TIKLAYINCA ASSETS DETAY SAYFASINA YÖNLENDİRME */}
                            <Link
                                href={`/assets/${h.symbol}`}
                                className="text-base font-bold text-white hover:text-indigo-400 transition flex items-center gap-1"
                            >
                                <span>{h.symbol}</span>
                                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-indigo-400" />
                            </Link>

                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {h.asset_type}
                            </span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-1">{h.asset_name}</p>

                        {/* Atanan Grup Etiketleri */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {assignedGroupObjects.map(g => (
                                <span
                                    key={g.id}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                    style={{
                                        backgroundColor: `${g.color}15`,
                                        color: g.color,
                                        borderColor: `${g.color}35`,
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }}></span>
                                    {g.name}
                                </span>
                            ))}

                            <button
                                onClick={() => setAssigningAsset(h)}
                                className="text-[10px] text-slate-500 hover:text-indigo-400 font-semibold transition cursor-pointer flex items-center gap-0.5 ml-1"
                                title="Grupları Düzenle"
                            >
                                <Tag className="w-3 h-3" />
                                <span>{assignedGroupObjects.length > 0 ? '+ Değiştir' : '+ Gruba Ata'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* SAĞ: DEĞERLER, MALİYET, FİYAT, PERİYOT GETİRİSİ VE KÂR/ZARAR */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-x-6 gap-y-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 text-right">
                    {/* Lot & Maliyet */}
                    <div>
                        <p className="text-[10px] text-slate-400">Adet • Ort. Maliyet</p>
                        <p className="text-xs font-semibold text-slate-200">
                            {h.total_amount.toLocaleString('tr-TR')} Adet • {fmt(h.average_cost)}
                        </p>
                    </div>

                    {/* Güncel Fiyat */}
                    <div>
                        <p className="text-[10px] text-slate-400">Güncel Fiyat</p>
                        <p className="text-xs font-semibold text-white font-mono">{fmt(h.current_price)}</p>
                    </div>

                    {/* Seçilen Periyot Getirisi (1D, 1W, 1M, vb.) */}
                    <div>
                        <p className="text-[10px] text-slate-400">{selectedPeriod} Getirisi</p>
                        {periodRetVal !== null ? (
                            <p className={`text-xs font-bold font-mono ${periodRetVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {periodRetVal >= 0 ? '+' : ''}{periodRetVal.toFixed(2)}%
                            </p>
                        ) : (
                            <p className="text-xs font-mono text-slate-500">—</p>
                        )}
                    </div>

                    {/* Toplam Tutar & Toplam Kâr/Zarar */}
                    <div className="min-w-[120px]">
                        <p className="text-sm font-black text-white">{fmt(h.total_value)}</p>
                        <p className={`text-xs font-bold flex items-center justify-end ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPos ? '+' : ''}{fmt(pnl)}
                            <span className="text-[10px] ml-1 font-mono">({isPos ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
                        </p>
                    </div>

                    {/* Detaya Gitme Butonu */}
                    <Link
                        href={`/assets/${h.symbol}`}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Varlık Detayına Git"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }
}
