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
import { formatCurrency } from '@/lib/formatters';
import { fetchAssetSummariesBulk, invalidateAssetCache } from '@/lib/assetCache';

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

    // Periyot Seçimi: 1D (Günlük), 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, ALL
    type Period = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'ALL';
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('1D');

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

    const loadData = async (isManualRefresh = false) => {
        try {
            setRefreshing(true);
            if (isManualRefresh) {
                invalidateAssetCache();
            }
            const [sumRes, holdRes] = await Promise.all([
                api.get<PortfolioSummary>('/portfolio/summary').catch(() => null),
                api.get<UserHolding[]>('/portfolio/holdings').catch(() => null),
            ]);

            if (sumRes?.data) setSummary(sumRes.data);
            if (holdRes?.data) {
                const holds = holdRes.data;
                setHoldings(holds);

                // Tüm varlıkların periyot getirilerini akıllı önbellekten veya batch istek ile çek
                const symbols = holds.map(h => h.symbol);
                const summaries = await fetchAssetSummariesBulk(symbols, isManualRefresh);
                if (Object.keys(summaries).length > 0) {
                    setAssetSummaries(prev => ({ ...prev, ...summaries }));
                }
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

    // Para formatlama — ortak formatters kütüphanesini kullanır
    const fmt = (amountTRY: number, showPlusSign: boolean = false): string => formatCurrency(amountTRY, currency, usdRate, showPlusSign);

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

    // Seçili grup ve seçili periyoda göre dinamik portföy / grup getiri ve metrikleri
    const activeGroupMetrics = useMemo(() => {
        let targetAssets: UserHolding[] = holdings;
        let groupName = 'Toplam Portföy';
        let groupColor: string | null = null;
        const isCustomGroup = activeTab !== 'all' && activeTab !== 'by_type';

        if (isCustomGroup) {
            const grp = groups.find(g => g.id === activeTab);
            if (grp) {
                groupName = grp.name;
                groupColor = grp.color;
            }
            targetAssets = holdings.filter(h => (assetGroups[h.symbol] || []).includes(activeTab));
        }

        const totalVal = targetAssets.reduce((sum, h) => sum + h.total_value, 0);
        const totalCost = targetAssets.reduce((sum, h) => sum + (h.average_cost * h.total_amount), 0);

        let pnlAmount = 0;
        let pnlPercent = 0;

        if (selectedPeriod === 'ALL') {
            pnlAmount = totalVal - totalCost;
            pnlPercent = totalCost > 0 ? (pnlAmount / totalCost) * 100 : 0;
        } else {
            // Dönemsel baz fiyat ve getiri hesabı:
            // Her varlık için dönemsel getiri oranı r = assetSummaries[h.symbol][selectedPeriod]
            // Varlığın dönem başındaki baz değeri: baseVal = curVal / (1 + r / 100)
            let totalBaseVal = 0;
            let hasAnyValidReturn = false;

            for (const h of targetAssets) {
                const sum = assetSummaries[h.symbol];
                const ret = sum?.[selectedPeriod];
                const curVal = h.total_value;

                if (ret !== undefined && !isNaN(ret) && ret !== 0) {
                    hasAnyValidReturn = true;
                    const baseVal = ret <= -100 ? 0 : curVal / (1 + (ret / 100));
                    totalBaseVal += baseVal;
                } else {
                    totalBaseVal += curVal;
                }
            }

            if (hasAnyValidReturn && totalBaseVal > 0) {
                pnlAmount = totalVal - totalBaseVal;
                pnlPercent = (pnlAmount / totalBaseVal) * 100;
            } else if (!isCustomGroup && summary?.period_returns?.[selectedPeriod] !== undefined && summary.period_returns[selectedPeriod] !== 0) {
                // Varlık bazında veri yoksa genel portföy snapshot getirisi
                pnlPercent = summary.period_returns[selectedPeriod];
                pnlAmount = totalVal * (pnlPercent / (100 + pnlPercent));
            } else {
                pnlAmount = 0;
                pnlPercent = 0;
            }
        }

        return {
            isCustomGroup,
            groupName,
            groupColor,
            assetCount: targetAssets.length,
            totalVal,
            totalCost,
            pnlAmount,
            pnlPercent,
        };
    }, [activeTab, groups, holdings, assetGroups, selectedPeriod, assetSummaries, summary]);

    if (authLoading || loading) {
        return <LoadingSpinner withLogo message="Varlıklarınız ve portföy grupları yükleniyor..." />;
    }

    const totalPortfolioVal = summary?.total_value || holdings.reduce((s, h) => s + h.total_value, 0);
    const totalPortfolioCost = summary?.total_cost || holdings.reduce((s, h) => s + (h.average_cost * h.total_amount), 0);
    const totalPortfolioPnl = totalPortfolioVal - totalPortfolioCost;
    const totalPortfolioPnlPct = totalPortfolioCost > 0 ? (totalPortfolioPnl / totalPortfolioCost) * 100 : 0;

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 1. ÜST BAR: BAŞLIK, PARA BİRİMİ TOGGLE, İŞLEM EKLE */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-sm shadow-sm">
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
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm border bg-slate-800 border-slate-700 hover:border-[#1A9FD3] hover:text-[#1A9FD3] active:scale-95 cursor-pointer text-slate-100"
                        >
                            <span className="text-base">{currency === 'TRY' ? '🇹🇷' : '🇺🇸'}</span>
                            <span>Para Birimi:</span>
                            <span className={`px-2 py-0.5 rounded-md font-extrabold ${currency === 'TRY' ? 'bg-[#1A9FD3]/15 text-[#1A9FD3]' : 'bg-[#1A9FD3]/15 text-[#1A9FD3]'}`}>
                                {currency === 'TRY' ? '₺ TRY' : '$ USD'}
                            </span>
                        </button>

                        {/* İşlem Ekle */}
                        <button
                            onClick={() => {
                                setTxSymbol('');
                                setTxAmount('');
                                setTxPrice('');
                                setIsTxModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20 cursor-pointer active:scale-95"
                        >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>İşlem Ekle</span>
                        </button>

                        {/* Yenile */}
                        <button
                            onClick={() => loadData(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3] transition disabled:opacity-50 cursor-pointer"
                            title="Yenile (Önbelleği Temizle)"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1A9FD3]' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* 2. PERİYOT BUTONLARI & PORTFÖY TOPLAM ÖZETİ */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    {/* PERİYOT SEÇİCİ: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, ALL */}
                    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                        <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5 shrink-0">
                            <Clock className="w-4 h-4 text-[#1A9FD3]" /> Getiri Dönemi:
                        </span>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 overflow-x-auto gap-1 no-scrollbar touch-pan-x max-w-full">
                            {(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPeriod(p)}
                                    className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer shrink-0 ${
                                        selectedPeriod === p
                                            ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold shadow-sm shadow-[#1A9FD3]/20'
                                            : 'text-slate-300 hover:text-[#1A9FD3] hover:bg-[#1A9FD3]/15'
                                    }`}
                                >
                                    {p === '1D' ? '1G' : p === '1W' ? '1H' : p === '1M' ? '1A' : p === '3M' ? '3A' : p === '6M' ? '6A' : p === 'YTD' ? 'YBB' : p === '1Y' ? '1Y' : p === '3Y' ? '3Y' : p === '5Y' ? '5Y' : 'Tümü'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Toplam Portföy / Seçili Grup Hızlı Göstergesi (BÜYÜK VE OKUNAKLI PUNTOLAR) */}
                    <div className="flex items-center gap-6 sm:gap-10 self-stretch lg:self-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                        <div>
                            <p className="text-xs sm:text-sm text-slate-400 font-medium">
                                {activeGroupMetrics.isCustomGroup ? `${activeGroupMetrics.groupName} Değeri` : 'Toplam Portföy Değeri'}
                            </p>
                            <p className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums mt-0.5">
                                {fmt(activeGroupMetrics.totalVal)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs sm:text-sm text-slate-400 font-medium">
                                {selectedPeriod === 'ALL'
                                    ? (activeGroupMetrics.isCustomGroup ? 'Grup Toplam Getiri' : 'Toplam Getiri (ALL)')
                                    : `${selectedPeriod === '1D' ? 'Günlük (1G)' : selectedPeriod === '1W' ? 'Haftalık (1H)' : selectedPeriod === '1M' ? 'Aylık (1A)' : selectedPeriod === '3M' ? '3 Aylık (3A)' : selectedPeriod === '6M' ? '6 Aylık (6A)' : selectedPeriod === 'YTD' ? 'Yılbaşından Bugüne (YBB)' : selectedPeriod === '1Y' ? 'Yıllık (1Y)' : selectedPeriod === '3Y' ? '3 Yıllık (3Y)' : selectedPeriod === '5Y' ? '5 Yıllık (5Y)' : selectedPeriod} K/Z`}
                            </p>
                            <p className={`text-2xl sm:text-3xl font-black flex items-center justify-end tracking-tight tabular-nums mt-0.5 ${activeGroupMetrics.pnlAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {fmt(activeGroupMetrics.pnlAmount, true)}
                                <span className={`text-xs sm:text-sm font-bold ml-2 px-2 py-0.5 rounded font-mono ${activeGroupMetrics.pnlAmount >= 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'}`}>
                                    {activeGroupMetrics.pnlAmount >= 0 ? '+' : ''}{activeGroupMetrics.pnlPercent.toFixed(2)}%
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. ÖZEL GRUP SEKMELERİ & YENİ GRUP OLUŞTURMA */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#1A9FD3]" /> Gruplar & Listeler
                        </span>
                        <div className="flex items-center gap-2">
                            {activeGroupMetrics.isCustomGroup && (
                                <button
                                    onClick={() => handleDeleteGroup(activeTab)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/25 active:scale-95"
                                    title={`"${activeGroupMetrics.groupName}" Grubunu Sil`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Grubu Sil</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="flex items-center gap-1 text-xs font-bold text-[#1A9FD3] hover:text-white transition cursor-pointer bg-[#1A9FD3]/10 hover:bg-[#0C6991] px-2.5 py-1.5 rounded-lg border border-[#1A9FD3]/30"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>+ Yeni Grup Oluştur</span>
                            </button>
                        </div>
                    </div>

                    {/* Grup Butonları / Sekmeleri (YÜKSEK KONTRASTLI VE SEÇİLİ DURUMDA NET OKUNUR) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                        {/* 1. TÜMÜ */}
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                activeTab === 'all'
                                    ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20'
                                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/10'
                            }`}
                        >
                            <span>Tüm Varlıklar</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${activeTab === 'all' ? 'bg-white/20 text-white font-bold' : 'bg-black/20 text-slate-300'}`}>
                                {holdings.length}
                            </span>
                        </button>

                        {/* 2. TÜRE GÖRE OTOMATİK GRUPLAMA */}
                        <button
                            onClick={() => setActiveTab('by_type')}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                activeTab === 'by_type'
                                    ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20'
                                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/10'
                            }`}
                        >
                            <span>Türe Göre Grupla</span>
                        </button>

                        {/* 3. KULLANICININ ÖZEL GRUPLARI */}
                        {groups.map(g => {
                            const count = holdings.filter(h => (assetGroups[h.symbol] || []).includes(g.id)).length;
                            const isActive = activeTab === g.id;
                            return (
                                <button
                                    key={g.id}
                                    onClick={() => setActiveTab(g.id)}
                                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 border ${
                                        isActive
                                            ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white border-[#1A9FD3] shadow-sm shadow-[#1A9FD3]/20'
                                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-[#1A9FD3] hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/10'
                                    }`}
                                >
                                    <span>{g.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${isActive ? 'bg-white/20 text-white font-bold' : 'bg-black/20 text-slate-300'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

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
                            className="w-full bg-slate-800/80 border border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                        />
                    </div>

                    {/* Sıralama Açılır Menüsü */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">Sırala:</span>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3] transition cursor-pointer"
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
                                <div key={typeKey} className="space-y-2.5">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-[#1A9FD3]"></span>
                                            {typeTitle} ({typeList.length})
                                        </h3>
                                        <span className="text-xs sm:text-sm font-bold text-slate-300 font-mono tabular-nums">{fmt(typeVal)}</span>
                                    </div>
                                    {renderHoldingsTable(typeList)}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // NORMAL VEYA ÖZEL GRUP LİSTESİ — GERÇEK TABLO DÜZENİ
                    <div>
                        {processedHoldings.length > 0 ? (
                            renderHoldingsTable(processedHoldings)
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                                <p className="text-base font-semibold text-white mb-1">Bu grupta veya aramada varlık bulunamadı.</p>
                                <p className="text-xs text-slate-500 mb-4">
                                    {activeTab !== 'all' ? 'Aşağıdaki butona basarak hisselerinizi bu gruba dahil edebilirsiniz.' : 'Portföyünüze yeni hisse veya fon işlemi ekleyin.'}
                                </p>
                                {activeTab !== 'all' && (
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className="px-4 py-2 bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FolderPlus className="w-5 h-5 text-[#1A9FD3]" />
                                Yeni Grup Oluştur
                            </h3>
                            <button onClick={() => setIsCreateGroupOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1A9FD3]"
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
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20 cursor-pointer"
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-white">Gruplara Ata: {assigningAsset.symbol}</h3>
                                <p className="text-xs text-slate-400">{assigningAsset.asset_name}</p>
                            </div>
                            <button onClick={() => setAssigningAsset(null)} className="text-slate-400 hover:text-white cursor-pointer">
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
                                                isAssigned ? 'bg-[#1A9FD3]/15 border-[#1A9FD3]/40 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }}></span>
                                                <span className="text-xs font-bold text-slate-200">{g.name}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isAssigned ? 'bg-[#1A9FD3] border-[#1A9FD3] text-white' : 'border-slate-700'}`}>
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
                                className="text-xs font-bold text-[#1A9FD3] hover:underline cursor-pointer"
                            >
                                + Yeni Grup Ekle
                            </button>
                            <button
                                onClick={() => setAssigningAsset(null)}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20 cursor-pointer"
                            >
                                Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. HIZLI İŞLEM EKLEME MODALI */}
            {isTxModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white">İşlem Ekle</h3>
                            <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white uppercase font-bold focus:outline-none focus:border-[#1A9FD3]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTxType('BUY')}
                                    className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${txType === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    Alış (BUY)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTxType('SELL')}
                                    className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${txType === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3]"
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3]"
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
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3]"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">Komisyon girilirse alış maliyetine eklenir, kâr/zarar hesabını etkiler.</p>
                            </div>

                            {/* Toplam İşlem Tutarı Özeti */}
                            {parseFloat(txAmount) > 0 && parseFloat(txPrice) > 0 && (
                                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5 text-xs sm:text-sm">
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span>İşlem Tutarı:</span>
                                        <span className="font-mono text-slate-200 font-medium">
                                            {((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                        </span>
                                    </div>
                                    {parseFloat(txCommission) > 0 && (
                                        <div className="flex justify-between items-center text-slate-300">
                                            <span>+ Komisyon:</span>
                                            <span className="font-mono font-medium">
                                                {parseFloat(txCommission).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                            </span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                                        <span className="text-slate-300 font-medium">Toplam {txType === 'BUY' ? 'Maliyet' : 'Net Tutar'}:</span>
                                        <span className="font-bold text-white font-mono text-sm sm:text-base">
                                            {(((parseFloat(txAmount) || 0) * (parseFloat(txPrice) || 0)) + (txType === 'BUY' ? (parseFloat(txCommission) || 0) : -(parseFloat(txCommission) || 0))).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                                        </span>
                                    </div>
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
                                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition disabled:opacity-50 cursor-pointer shadow-sm shadow-[#1A9FD3]/20"
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

    // Gerçek Finansal Tablo Render Fonksiyonu
    function renderHoldingsTable(items: UserHolding[]) {
        const periodHeaderLabel = selectedPeriod === 'ALL'
            ? 'Toplam Maliyet'
            : selectedPeriod === '1D'
            ? 'Günlük (1G) %'
            : selectedPeriod === '1W'
            ? 'Haftalık (1H) %'
            : selectedPeriod === '1M'
            ? 'Aylık (1A) %'
            : selectedPeriod === '3M'
            ? '3 Aylık (3A) %'
            : selectedPeriod === '6M'
            ? '6 Aylık (6A) %'
            : selectedPeriod === 'YTD'
            ? 'Yılbaşından Bugüne (YBB) %'
            : selectedPeriod === '1Y'
            ? 'Yıllık (1Y) %'
            : selectedPeriod === '3Y'
            ? '3 Yıllık (3Y) %'
            : selectedPeriod === '5Y'
            ? '5 Yıllık (5Y) %'
            : `${selectedPeriod} %`;

        return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                                <th scope="col" className="py-3.5 pl-5 pr-3">Varlık</th>
                                <th scope="col" className="py-3.5 px-3">Tür</th>
                                <th scope="col" className="py-3.5 px-3 text-right">Adet & Maliyet</th>
                                <th scope="col" className="py-3.5 px-3 text-right">Güncel Fiyat</th>
                                <th scope="col" className="py-3.5 px-3 text-right">{periodHeaderLabel}</th>
                                <th scope="col" className="py-3.5 px-3 text-right">Piyasa Değeri</th>
                                <th scope="col" className="py-3.5 px-3 text-right">Net Kâr / Zarar</th>
                                <th scope="col" className="py-3.5 pl-3 pr-5 text-center w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-sm">
                            {items.map(h => {
                                const costVal = h.average_cost * h.total_amount;
                                const pnl = h.profit_loss;
                                const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0;
                                const isPos = pnl >= 0;

                                const sum = assetSummaries[h.symbol];
                                let periodRetVal: number | null = null;
                                if (selectedPeriod === 'ALL') {
                                    periodRetVal = pnlPct;
                                } else if (sum && sum[selectedPeriod] !== undefined) {
                                    periodRetVal = sum[selectedPeriod];
                                }

                                const assignedGroupIds = assetGroups[h.symbol] || [];
                                const assignedGroupObjects = groups.filter(g => assignedGroupIds.includes(g.id));

                                return (
                                    <tr key={h.symbol} className="hover:bg-slate-800/40 transition-colors group">
                                        {/* VARLIK (Sembol & Şirket Adı & Grup Etiketleri) */}
                                        <td className="py-3.5 pl-5 pr-3">
                                            <div className="flex items-center gap-3">
                                                <Link
                                                    href={`/assets/${h.symbol}`}
                                                    className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-white group-hover:border-[#1A9FD3]/50 group-hover:bg-[#1A9FD3]/10 transition shrink-0"
                                                    title="Detaylı Grafik ve Analiz"
                                                >
                                                    <span className="text-xs font-black font-mono tracking-tight text-[#1A9FD3]">
                                                        {h.symbol.slice(0, 4)}
                                                    </span>
                                                </Link>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <Link
                                                            href={`/assets/${h.symbol}`}
                                                            className="font-bold text-white group-hover:text-[#1A9FD3] transition flex items-center gap-1 text-sm sm:text-base"
                                                        >
                                                            <span>{h.symbol}</span>
                                                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-[#1A9FD3]" />
                                                        </Link>
                                                    </div>
                                                    <p className="text-xs text-slate-400 truncate max-w-[180px] lg:max-w-[240px]">
                                                        {h.asset_name}
                                                    </p>
                                                    {/* Grup Etiketleri & Düzenle Butonu */}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        {assignedGroupObjects.map(g => (
                                                            <span
                                                                key={g.id}
                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
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
                                                            className="text-[11px] text-slate-500 hover:text-[#1A9FD3] font-medium transition cursor-pointer flex items-center gap-0.5"
                                                            title="Grupları Düzenle"
                                                        >
                                                            <Tag className="w-2.5 h-2.5" />
                                                            <span>{assignedGroupObjects.length > 0 ? 'Düzenle' : '+ Gruba Ata'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* TÜR ROZETİ */}
                                        <td className="py-3.5 px-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                                {h.asset_type}
                                            </span>
                                        </td>

                                        {/* ADET & ORT. MALİYET */}
                                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-semibold text-slate-200 tabular-nums">
                                                {h.total_amount.toLocaleString('tr-TR')} Adet
                                            </div>
                                            <div className="text-xs text-slate-400 tabular-nums">
                                                Ort. {fmt(h.average_cost)}
                                            </div>
                                        </td>

                                        {/* GÜNCEL FİYAT */}
                                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                            <div className="text-sm sm:text-base font-bold text-white font-mono tabular-nums">
                                                {fmt(h.current_price)}
                                            </div>
                                        </td>

                                        {/* DÖNEMSEL GETİRİ / TOPLAM MALİYET */}
                                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                            {selectedPeriod === 'ALL' ? (
                                                <div className="text-sm font-semibold text-slate-300 tabular-nums">
                                                    {fmt(costVal)}
                                                </div>
                                            ) : (
                                                <>
                                                    {periodRetVal !== null ? (
                                                        <div className={`text-sm sm:text-base font-black font-mono tabular-nums ${periodRetVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {periodRetVal >= 0 ? '+' : ''}{periodRetVal.toFixed(2)}%
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-mono text-slate-500">—</div>
                                                    )}
                                                </>
                                            )}
                                        </td>

                                        {/* PİYASA DEĞERİ */}
                                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                            <div className="text-sm sm:text-base font-black text-white tabular-nums">
                                                {fmt(h.total_value)}
                                            </div>
                                        </td>

                                        {/* NET KÂR / ZARAR */}
                                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                            <div className={`text-sm sm:text-base font-black font-mono tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {fmt(pnl, true)}
                                            </div>
                                            <div className={`text-xs font-bold font-mono tabular-nums ${isPos ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                                                {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
                                            </div>
                                        </td>

                                        {/* DETAY OKU */}
                                        <td className="py-3.5 pl-3 pr-5 text-center">
                                            <Link
                                                href={`/assets/${h.symbol}`}
                                                className="inline-flex p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                                title="Detaya Git"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* MOBİL GÖRÜNÜM (60 Yaşında Kullanıcı İçin Yüksek Kontrastlı, Okunaklı Kompakt Kart-Satır Düzeni) */}
                <div className="md:hidden divide-y divide-slate-800/80">
                    {items.map(h => {
                        const costVal = h.average_cost * h.total_amount;
                        const pnl = h.profit_loss;
                        const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0;
                        const isPos = pnl >= 0;

                        const sum = assetSummaries[h.symbol];
                        let periodRetVal: number | null = null;
                        if (selectedPeriod === 'ALL') {
                            periodRetVal = pnlPct;
                        } else if (sum && sum[selectedPeriod] !== undefined) {
                            periodRetVal = sum[selectedPeriod];
                        }

                        const assignedGroupIds = assetGroups[h.symbol] || [];
                        const assignedGroupObjects = groups.filter(g => assignedGroupIds.includes(g.id));

                        return (
                            <div key={h.symbol} className="p-4 space-y-3">
                                {/* ÜST BAŞLIK: Sembol, Tür, Değer, Detay linki */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <Link
                                            href={`/assets/${h.symbol}`}
                                            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shrink-0"
                                        >
                                            <span className="text-xs font-black font-mono text-[#1A9FD3]">
                                                {h.symbol.slice(0, 4)}
                                            </span>
                                        </Link>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <Link href={`/assets/${h.symbol}`} className="text-base font-bold text-white">
                                                    {h.symbol}
                                                </Link>
                                                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                                                    {h.asset_type}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-1">{h.asset_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base font-black text-white tabular-nums">
                                            {fmt(h.total_value)}
                                        </div>
                                        <div className={`text-xs font-bold font-mono tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {fmt(pnl, true)} ({isPos ? '+' : ''}{pnlPct.toFixed(2)}%)
                                        </div>
                                    </div>
                                </div>

                                {/* ORTA VERİ GRİDİ (2 Kolon) */}
                                <div className="grid grid-cols-2 gap-2.5 py-2 px-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
                                    <div>
                                        <span className="text-slate-400 block mb-0.5">Adet • Ort. Maliyet</span>
                                        <span className="font-semibold text-slate-200 tabular-nums">
                                            {h.total_amount.toLocaleString('tr-TR')} • {fmt(h.average_cost)}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 block mb-0.5">Güncel Fiyat</span>
                                        <span className="font-bold text-white font-mono tabular-nums text-sm">
                                            {fmt(h.current_price)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block mb-0.5">
                                            {selectedPeriod === 'ALL' ? 'Toplam Maliyet' : `${selectedPeriod} Getirisi`}
                                        </span>
                                        {selectedPeriod === 'ALL' ? (
                                            <span className="font-semibold text-slate-300 tabular-nums">
                                                {fmt(costVal)}
                                            </span>
                                        ) : (
                                            <span className={`font-bold font-mono tabular-nums ${periodRetVal !== null && periodRetVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {periodRetVal !== null ? `${periodRetVal >= 0 ? '+' : ''}${periodRetVal.toFixed(2)}%` : '—'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right flex items-center justify-end">
                                        <Link
                                            href={`/assets/${h.symbol}`}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-[#1A9FD3] hover:underline"
                                        >
                                            Grafik & Detay <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>

                                {/* ALT GRUP ETİKETLERİ */}
                                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {assignedGroupObjects.map(g => (
                                            <span
                                                key={g.id}
                                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
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
                                    </div>
                                    <button
                                        onClick={() => setAssigningAsset(h)}
                                        className="text-[11px] text-slate-400 hover:text-[#1A9FD3] font-medium transition cursor-pointer flex items-center gap-1 ml-auto"
                                    >
                                        <Tag className="w-3 h-3" />
                                        <span>{assignedGroupObjects.length > 0 ? 'Grupları Düzenle' : '+ Gruba Dahil Et'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}
