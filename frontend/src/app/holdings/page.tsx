'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PortfolioSummary, UserHolding, AssetGroup, Period } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
    Briefcase,
    Layers,
    Plus,
    Search,
    SlidersHorizontal,
    FolderPlus,
    X,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    RefreshCw,
    Clock,
    Settings2,
    Trash2,
    ChevronUp,
    ChevronDown,
    GripVertical,
    Coins,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useCurrency } from '@/hooks/useCurrency';
import { fetchAssetSummariesBulk, invalidateAssetCache } from '@/lib/assetCache';
import { isHoldingNewerThanPeriod } from '@/lib/periodUtils';
import TransactionHistoryTab from '@/components/holdings/TransactionHistoryTab';
import DividendsTab from '@/components/holdings/DividendsTab';
import CreateGroupModal from '@/components/holdings/CreateGroupModal';
import AssignGroupModal from '@/components/holdings/AssignGroupModal';
import ManageGroupsModal from '@/components/holdings/ManageGroupsModal';
import AddTransactionModal from '@/components/holdings/AddTransactionModal';
import DeleteAssetModal from '@/components/holdings/DeleteAssetModal';
import HoldingsTable from '@/components/holdings/HoldingsTable';

export default function HoldingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [holdings, setHoldings] = useState<UserHolding[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Para birimi seçimi: 'TRY' veya 'USD'
    const { currency, toggleCurrency } = useCurrency();

    // Ana Görünüm Sekmesi: 'positions' (Portföy Pozisyonlarım) | 'transactions' (İşlem Geçmişi) | 'dividends' (Temettülerim)
    const [mainViewTab, setMainViewTab] = useState<'positions' | 'transactions' | 'dividends'>('positions');

    // URL parametresine göre sekme yönetimi (?tab=transactions veya ?tab=dividends)
    useEffect(() => {
        const checkTab = () => {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const tab = params.get('tab');
                if (tab === 'transactions' || tab === 'history') {
                    setMainViewTab('transactions');
                } else if (tab === 'dividends' || tab === 'temettu') {
                    setMainViewTab('dividends');
                } else {
                    setMainViewTab('positions');
                }
            }
        };
        checkTab();
        window.addEventListener('popstate', checkTab);
        return () => window.removeEventListener('popstate', checkTab);
    }, []);

    // Periyot Seçimi: 1D (Günlük), 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, ALL
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('1D');

    // Her varlığın periyot getiri verileri (symbol -> { 1D: number, 1W: number, ... })
    const [assetSummaries, setAssetSummaries] = useState<Record<string, Record<string, number>>>({});

    // Gruplar ve Varlık-Grup Eşleşmeleri
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [assetGroups, setAssetGroups] = useState<Record<string, string[]>>({}); // symbol -> [groupId1, groupId2]

    // Aktif Seçili Sekme: 'all' | 'by_type' | groupId
    const [activeTab, setActiveTab] = useState<string>('all');

    // Grup Sekmeleri Yatay Kaydırma & Çok Satırlı (Wrap) Durumları
    const groupsContainerRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isGroupsWrapped, setIsGroupsWrapped] = useState(false);

    // Arama ve Sıralama (Özel manuel sıralama desteği eklendi)
    const [searchQuery, setSearchQuery] = useState('');
    type HoldingsSortType = 'custom' | 'val_desc' | 'pnl_desc' | 'pnl_asc' | 'name_asc' | 'amount_desc';
    const [sortBy, setSortBy] = useState<HoldingsSortType>('val_desc');
    const [customAssetOrder, setCustomAssetOrder] = useState<string[]>([]);

    // Grup Sekmeleri Sürükle & Bırak State'leri
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

    // Modal Durumları
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
    const [deletingAsset, setDeletingAsset] = useState<UserHolding | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [assigningAsset, setAssigningAsset] = useState<UserHolding | null>(null);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [txModalSymbol, setTxModalSymbol] = useState('');
    const [txModalType, setTxModalType] = useState<'BUY' | 'SELL'>('BUY');
    const [txModalPrice, setTxModalPrice] = useState('');
    const [txModalMaxLots, setTxModalMaxLots] = useState<number | undefined>(undefined);

    const handleQuickAddTx = (symbol: string = '') => {
        setTxModalSymbol(symbol);
        setTxModalType('BUY');
        setTxModalPrice('');
        setTxModalMaxLots(undefined);
        setIsTxModalOpen(true);
    };

    const handleQuickSellTx = (holding: UserHolding) => {
        setTxModalSymbol(holding.symbol);
        setTxModalType('SELL');
        setTxModalPrice(holding.current_price ? String(holding.current_price) : '');
        setTxModalMaxLots(holding.total_amount);
        setIsTxModalOpen(true);
    };

    // Özel sıra ve grupları localStorage'dan yükle
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const userId = user?.id || 'default';
            const savedWrap = localStorage.getItem(`user_groups_wrap_${userId}`);
            if (savedWrap === 'true') {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsGroupsWrapped(true);
            }
            const savedGroups = localStorage.getItem(`user_groups_${userId}`);
            const savedAssetGroups = localStorage.getItem(`asset_groups_${userId}`);
            const savedOrder = localStorage.getItem(`custom_asset_order_${userId}`);
            const savedSort = localStorage.getItem(`holdings_sort_by_${userId}`);

            const validSorts: HoldingsSortType[] = ['custom', 'val_desc', 'pnl_desc', 'pnl_asc', 'name_asc', 'amount_desc'];
            if (savedSort && (validSorts as string[]).includes(savedSort)) {
                setSortBy(savedSort as HoldingsSortType);
            }

            if (savedOrder) {
                try {
                    const parsedOrder = JSON.parse(savedOrder);
                    if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
                        setCustomAssetOrder(parsedOrder);
                    }
                } catch (e) {
                    console.error('Özel sıra ayrıştırma hatası:', e);
                }
            }

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void loadData();
        }
    }, [user, authLoading, router]);

    const usdRate = summary?.usd_rate && summary.usd_rate > 0 ? summary.usd_rate : 48.65;

    // Para formatlama — ortak formatters kütüphanesini kullanır
    const fmt = (amountTRY: number, showPlusSign: boolean = false): string => formatCurrency(amountTRY, currency, usdRate, showPlusSign);

    // Yeni Grup Oluştur
    const handleCreateGroup = (name: string, color: string) => {
        const newGroup: AssetGroup = {
            id: 'grp_' + Date.now(),
            name: name.trim(),
            color,
        };
        const updated = [...groups, newGroup];
        saveGroups(updated, assetGroups);
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

    // Varlık Sürükle & Bırak ile Sıralama (Drag and Drop)
    const handleDropAsset = (draggedSymbol: string, targetSymbol: string) => {
        const visibleSymbols = processedHoldings.map(h => h.symbol);
        const fromIndex = visibleSymbols.indexOf(draggedSymbol);
        const toIndex = visibleSymbols.indexOf(targetSymbol);
        if (fromIndex === -1 || toIndex === -1) return;

        const newVisible = [...visibleSymbols];
        const [moved] = newVisible.splice(fromIndex, 1);
        newVisible.splice(toIndex, 0, moved);

        // Görünür olmayan diğer varlıkları sona ekle
        const otherSymbols = holdings.map(h => h.symbol).filter(s => !newVisible.includes(s));
        const finalOrder = [...newVisible, ...otherSymbols];

        setCustomAssetOrder(finalOrder);
        setSortBy('custom');
        if (typeof window !== 'undefined') {
            const userId = user?.id || 'default';
            localStorage.setItem(`custom_asset_order_${userId}`, JSON.stringify(finalOrder));
            localStorage.setItem(`holdings_sort_by_${userId}`, 'custom');
        }
    };

    // Sıralama Değişimini Kaydet
    const handleSortChange = (newSort: typeof sortBy) => {
        setSortBy(newSort);
        if (typeof window !== 'undefined') {
            const userId = user?.id || 'default';
            localStorage.setItem(`holdings_sort_by_${userId}`, newSort);
        }
    };

    // Grupları Sürükle & Bırak ile Sıralama (Drag and Drop)
    const handleDropGroup = (targetGroupId: string, fromId?: string) => {
        const sourceId = fromId || draggedGroupId;
        if (!sourceId || sourceId === targetGroupId) {
            setDraggedGroupId(null);
            setDragOverGroupId(null);
            return;
        }

        const fromIndex = groups.findIndex(g => g.id === sourceId);
        const toIndex = groups.findIndex(g => g.id === targetGroupId);
        if (fromIndex === -1 || toIndex === -1) {
            setDraggedGroupId(null);
            setDragOverGroupId(null);
            return;
        }

        const updated = [...groups];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);

        saveGroups(updated, assetGroups);
        setDraggedGroupId(null);
        setDragOverGroupId(null);
    };

    // Grupları Yukarı / Aşağı Taşı
    const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
        const index = groups.findIndex(g => g.id === groupId);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= groups.length) return;

        const updated = [...groups];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        saveGroups(updated, assetGroups);
    };

    // Grup sekmelerinde sağa/sola taşma olup olmadığını denetle
    const checkGroupsScroll = () => {
        const el = groupsContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 6);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
    };

    // Butonlarla sekmeleri yumuşak kaydırma
    const scrollGroups = (direction: 'left' | 'right') => {
        const el = groupsContainerRef.current;
        if (!el) return;
        const amount = Math.max(200, el.clientWidth * 0.65);
        el.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth'
        });
    };

    // Fare tekerleğiyle yatay kaydırma desteği (Shift tuşuna basmadan mouse wheel ile kaydırma)
    const handleGroupsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (isGroupsWrapped) return;
        const el = groupsContainerRef.current;
        if (!el) return;
        if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) {
            el.scrollLeft += e.deltaY;
            checkGroupsScroll();
        }
    };

    // Grup sayısı veya pencere boyutu değiştiğinde kaydırma oklarını güncelle
    useEffect(() => {
        checkGroupsScroll();
        const handleResize = () => checkGroupsScroll();
        window.addEventListener('resize', handleResize);
        const timer = setTimeout(checkGroupsScroll, 150);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timer);
        };
    }, [groups, isGroupsWrapped]);

    // Aktif sekme değiştiğinde otomatik görünür alana kaydır
    useEffect(() => {
        if (!isGroupsWrapped && activeTab && groupsContainerRef.current) {
            const activeEl = groupsContainerRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
        const timer = setTimeout(checkGroupsScroll, 150);
        return () => clearTimeout(timer);
    }, [activeTab, isGroupsWrapped]);

    // Seçili Gruptan Tek Tıkla Çıkar
    const handleRemoveFromCurrentGroup = (symbol: string) => {
        if (activeTab === 'all' || activeTab === 'by_type') return;
        toggleAssetInGroup(symbol, activeTab);
    };

    // Varlığı Portföyden Tamamen Silme Onayı
    const handleConfirmDeleteAsset = async () => {
        if (!deletingAsset) return;
        try {
            setDeleteSubmitting(true);
            await api.delete(`/portfolio/holdings/${encodeURIComponent(deletingAsset.symbol)}`);
            invalidateAssetCache(deletingAsset.symbol);
            setDeletingAsset(null);
            await loadData(true);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            alert(error.response?.data?.error || 'Varlık silinirken hata oluştu');
        } finally {
            setDeleteSubmitting(false);
        }
    };


    // Filtrelenmiş ve Sıralanmış Varlıklar
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
            if (sortBy === 'custom') {
                const aIdx = customAssetOrder.indexOf(a.symbol);
                const bIdx = customAssetOrder.indexOf(b.symbol);
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return b.total_value - a.total_value;
            }

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
    }, [holdings, activeTab, assetGroups, searchQuery, sortBy, customAssetOrder]);

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
            let totalBaseVal = 0;
            let hasAnyValidReturn = false;

            for (const h of targetAssets) {
                const sum = assetSummaries[h.symbol];
                const ret = sum?.[selectedPeriod];
                const retAll = sum?.['ALL'];
                const curVal = h.total_value;
                const costVal = h.average_cost * h.total_amount;

                // Eğer hisse seçilen periyottan daha yeniyse (veya bu periyot başladıktan sonra portföye girmişse),
                // borsa ilk fiyatı yerine kullanıcının gerçek alış maliyeti baz alınır.
                const isNewer = isHoldingNewerThanPeriod(h.first_buy_date, selectedPeriod, ret ?? null, retAll ?? null);

                if (isNewer) {
                    hasAnyValidReturn = true;
                    totalBaseVal += costVal > 0 ? costVal : curVal;
                } else if (ret !== undefined && !isNaN(ret) && ret !== 0) {
                    hasAnyValidReturn = true;
                    const baseVal = ret <= -100 ? 0 : curVal / (1 + (ret / 100));
                    totalBaseVal += baseVal;
                } else {
                    totalBaseVal += costVal > 0 ? costVal : curVal;
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
                pnlAmount = totalVal - totalCost;
                pnlPercent = totalCost > 0 ? (pnlAmount / totalCost) * 100 : 0;
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
                        {/* Para Birimi Dönüştürücü (TRY / USD) */}
                        <button
                            onClick={toggleCurrency}
                            title="Tüm değerleri Dolar veya TL cinsinden görüntüle"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm border bg-slate-800 border-slate-700 hover:border-[#1A9FD3] hover:text-[#1A9FD3] active:scale-95 cursor-pointer text-slate-100"
                        >
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-200">
                                {currency}
                            </span>
                            <span>Para Birimi:</span>
                            <span className="px-2 py-0.5 rounded-md font-extrabold bg-[#1A9FD3]/15 text-[#1A9FD3]">
                                {currency === 'TRY' ? '₺ TRY' : '$ USD'}
                            </span>
                        </button>

                        {/* İşlem Ekle */}
                        <button
                            onClick={() => handleQuickAddTx('')}
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

                {/* 1.1 ANA SEKMELER: [Portföy Pozisyonlarım] | [İşlem Geçmişi] | [Temettülerim] */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => {
                            setMainViewTab('positions');
                            if (typeof window !== 'undefined') {
                                window.history.replaceState(null, '', '/holdings');
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                            mainViewTab === 'positions'
                                ? 'bg-[#1A9FD3] text-white shadow-md shadow-[#1A9FD3]/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Briefcase className="w-4 h-4" />
                        <span>Portföy Pozisyonlarım</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            mainViewTab === 'positions' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                            {holdings.length}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            setMainViewTab('transactions');
                            if (typeof window !== 'undefined') {
                                window.history.replaceState(null, '', '/holdings?tab=transactions');
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                            mainViewTab === 'transactions'
                                ? 'bg-[#1A9FD3] text-white shadow-md shadow-[#1A9FD3]/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>İşlem Geçmişi</span>
                    </button>

                    <button
                        onClick={() => {
                            setMainViewTab('dividends');
                            if (typeof window !== 'undefined') {
                                window.history.replaceState(null, '', '/holdings?tab=dividends');
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                            mainViewTab === 'dividends'
                                ? 'bg-[#1A9FD3] text-white shadow-md shadow-[#1A9FD3]/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Coins className="w-4 h-4" />
                        <span>Temettülerim</span>
                    </button>
                </div>

                {mainViewTab === 'transactions' ? (
                    <TransactionHistoryTab
                        currency={currency}
                        usdRate={summary?.usd_rate || 48.65}
                        onRefreshHoldings={() => loadData(true)}
                        onOpenAddTxModal={() => handleQuickAddTx('')}
                    />
                ) : mainViewTab === 'dividends' ? (
                    <DividendsTab
                        currency={currency}
                        usdRate={summary?.usd_rate || 48.65}
                        holdings={holdings}
                        onRefreshHoldings={() => loadData(true)}
                    />
                ) : (
                    <>
                {/* 2. PERİYOT BUTONLARI & PORTFÖY TOPLAM ÖZETİ */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    {/* PERİYOT SEÇİCİ: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, ALL */}
                    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                        <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5 shrink-0">
                            <Clock className="w-4 h-4 text-slate-400" /> Getiri Dönemi:
                        </span>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 overflow-x-auto gap-1 no-scrollbar touch-pan-x max-w-full">
                            {(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPeriod(p)}
                                    className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer shrink-0 ${
                                        selectedPeriod === p
                                            ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white font-bold shadow-sm shadow-[#1A9FD3]/20'
                                            : 'text-slate-300 hover:text-[#1A9FD3] hover:bg-[#1A9FD3]/15'
                                    }`}
                                >
                                    {p === '1D' ? '1G' : p === '1W' ? '1H' : p === '1M' ? '1A' : p === '3M' ? '3A' : p === '6M' ? '6A' : p === 'YTD' ? 'YBB' : p === '1Y' ? '1Y' : p === '3Y' ? '3Y' : 'Tümü'}
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
                                {fmt(activeGroupMetrics.isCustomGroup ? activeGroupMetrics.totalVal : (activeGroupMetrics.totalVal + (summary?.total_dividends || 0)))}
                            </p>
                            {!activeGroupMetrics.isCustomGroup && (summary?.total_dividends || 0) > 0 && (
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium flex items-center gap-1.5">
                                    <span>Varlıklar: <strong className="text-slate-300 font-mono font-medium">{fmt(activeGroupMetrics.totalVal)}</strong></span>
                                    <span>•</span>
                                    <span>Nakit Temettü: <strong className="text-emerald-400 font-mono">+{fmt(summary?.total_dividends || 0)}</strong></span>
                                </p>
                            )}
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-slate-400" /> Gruplar & Listeler
                            </span>
                            {groups.length > 1 && (
                                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                                    • Sıralamak için sekmeleri sürükleyip bırakabilirsiniz
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Seçili Grubu Sil Butonu */}
                            {activeGroupMetrics.isCustomGroup && (
                                <button
                                    onClick={() => handleDeleteGroup(activeTab)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-white transition cursor-pointer bg-rose-500/10 hover:bg-rose-600 px-3 py-1.5 rounded-xl border border-rose-500/25 active:scale-95"
                                    title={`"${activeGroupMetrics.groupName}" Grubunu Sil`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Grubu Sil</span>
                                </button>
                            )}

                            {/* Grupları Toplu Sırala ve Yönet */}
                            {groups.length > 0 && (
                                <button
                                    onClick={() => setIsManageGroupsOpen(true)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95"
                                    title="Grupların Sırasını Değiştir & Yönet"
                                >
                                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Grupları Yönet</span>
                                </button>
                            )}

                            {/* Çok Satırlı / Tek Satır Görünüm Değiştirici */}
                            {groups.length > 2 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = !isGroupsWrapped;
                                        setIsGroupsWrapped(next);
                                        if (typeof window !== 'undefined') {
                                            const userId = user?.id || 'default';
                                            localStorage.setItem(`user_groups_wrap_${userId}`, next ? 'true' : 'false');
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition cursor-pointer px-3 py-1.5 rounded-xl border active:scale-95 ${
                                        isGroupsWrapped
                                            ? 'bg-slate-800 border-slate-700 text-slate-200'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                                    }`}
                                    title={isGroupsWrapped ? "Tek satırda kaydırmalı görünüme geç" : "Tüm grupları aynı anda göster (Çok satırlı)"}
                                >
                                    {isGroupsWrapped ? (
                                        <>
                                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Kompakt Satır</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Tümünü Göster</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="flex items-center gap-1 text-xs font-bold text-white transition cursor-pointer bg-[#1A9FD3] hover:bg-[#0C6991] px-3 py-1.5 rounded-xl border border-[#1A9FD3]/30 shadow-sm shadow-[#1A9FD3]/20"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>+ Yeni Grup</span>
                            </button>
                        </div>
                    </div>

                    {/* Grup Butonları / Sekmeleri (SÜRÜKLE & BIRAK & ÇOK SATIR / KAYDIRMA DESTEKLİ) */}
                    <div className="relative group/tabs">
                        {/* Sol Kaydırma Oku (Yalnızca tek satır modunda ve sola kaydırılabiliyorsa görünür) */}
                        {!isGroupsWrapped && canScrollLeft && (
                            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
                                <button
                                    type="button"
                                    onClick={() => scrollGroups('left')}
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800/95 hover:bg-[#1A9FD3] text-slate-300 hover:text-white border border-slate-700/80 hover:border-[#1A9FD3] flex items-center justify-center shadow-lg transition active:scale-90 pointer-events-auto cursor-pointer"
                                    title="Sola Kaydır"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Sekmeler Konteyneri */}
                        <div
                            ref={groupsContainerRef}
                            onScroll={checkGroupsScroll}
                            onWheel={handleGroupsWheel}
                            className={`flex items-center gap-2 py-1 touch-pan-x transition-all duration-200 ${
                                isGroupsWrapped
                                    ? 'flex-wrap'
                                    : 'overflow-x-auto custom-horizontal-scrollbar scroll-smooth'
                            }`}
                        >
                            {/* 1. TÜMÜ */}
                            <button
                                data-tab-id="all"
                                onClick={() => setActiveTab('all')}
                                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                    activeTab === 'all'
                                        ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20'
                                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/20'
                                }`}
                            >
                                <span>Tüm Varlıklar</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${activeTab === 'all' ? 'bg-white/20 text-white font-bold' : 'bg-black/20 text-slate-300'}`}>
                                    {holdings.length}
                                </span>
                            </button>

                            {/* 2. TÜRE GÖRE OTOMATİK GRUPLAMA */}
                            <button
                                data-tab-id="by_type"
                                onClick={() => setActiveTab('by_type')}
                                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                                    activeTab === 'by_type'
                                        ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20'
                                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/20'
                                }`}
                            >
                                <span>Türe Göre Grupla</span>
                            </button>

                            {/* 3. KULLANICININ ÖZEL GRUPLARI (SÜRÜKLENEBİLİR) */}
                            {groups.map(g => {
                                const count = holdings.filter(h => (assetGroups[h.symbol] || []).includes(g.id)).length;
                                const isActive = activeTab === g.id;
                                const isDragging = draggedGroupId === g.id;
                                const isOver = dragOverGroupId === g.id;

                                return (
                                    <div
                                        key={g.id}
                                        data-tab-id={g.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', g.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            setDraggedGroupId(g.id);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (dragOverGroupId !== g.id) setDragOverGroupId(g.id);
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverGroupId === g.id) setDragOverGroupId(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleDropGroup(g.id);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedGroupId(null);
                                            setDragOverGroupId(null);
                                        }}
                                        className={`transition-all duration-150 shrink-0 cursor-grab active:cursor-grabbing rounded-xl ${
                                            isDragging ? 'opacity-30 scale-95' : ''
                                        } ${isOver ? 'ring-2 ring-[#1A9FD3] ring-offset-2 ring-offset-slate-900' : ''}`}
                                        title="Sırasını değiştirmek için sürükleyip bırakabilirsiniz"
                                    >
                                        <button
                                            onClick={() => setActiveTab(g.id)}
                                            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 border select-none w-full ${
                                                isActive
                                                    ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white border-[#1A9FD3] shadow-sm shadow-[#1A9FD3]/20'
                                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/20'
                                            }`}
                                        >
                                            <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-white opacity-70 -ml-1 cursor-grab" />
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }}></span>
                                            <span>{g.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${isActive ? 'bg-white/20 text-white font-bold' : 'bg-black/20 text-slate-300'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sağ Kaydırma Oku (Yalnızca tek satır modunda ve sağda daha fazla grup varsa görünür) */}
                        {!isGroupsWrapped && canScrollRight && (
                            <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 bg-gradient-to-l from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
                                <button
                                    type="button"
                                    onClick={() => scrollGroups('right')}
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800/95 hover:bg-[#1A9FD3] text-slate-200 hover:text-white border border-[#1A9FD3]/40 hover:border-[#1A9FD3] flex items-center justify-center shadow-lg shadow-[#1A9FD3]/10 transition active:scale-90 pointer-events-auto cursor-pointer"
                                    title="Daha Fazla Grubu Göster (Sağa Kaydır)"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. ARAMA VE SIRALAMA KONTROLLERİ */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    {/* Arama Kutusu (Hızlı Temizle X Butonu ile) */}
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Sembol veya hisse ara..."
                            className="w-full bg-slate-800/80 border border-slate-700/70 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9FD3] transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full transition"
                                title="Aramayı Temizle"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Sıralama Açılır Menüsü */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-400">Sırala:</span>
                            <select
                                value={sortBy}
                                onChange={e => handleSortChange(e.target.value as typeof sortBy)}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#1A9FD3] transition cursor-pointer"
                            >
                                <option value="custom">Özel Sıralamam (Manuel)</option>
                                <option value="val_desc">En Yüksek Değer (Azalan)</option>
                                <option value="pnl_desc">En Çok Kazandıranlar (Kâr %)</option>
                                <option value="pnl_asc">En Çok Kaybettirenler (Zarar %)</option>
                                <option value="name_asc">Alfabetik (A-Z)</option>
                                <option value="amount_desc">Adet / Lot (Azalan)</option>
                            </select>
                        </div>
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
                                    <HoldingsTable
                                        items={typeList}
                                        selectedPeriod={selectedPeriod}
                                        assetSummaries={assetSummaries}
                                        groups={groups}
                                        assetGroups={assetGroups}
                                        fmt={fmt}
                                        activeGroupMetrics={activeGroupMetrics}
                                        onQuickAddTx={handleQuickAddTx}
                                        onQuickSellTx={handleQuickSellTx}
                                        onAssignAsset={setAssigningAsset}
                                        onDeleteAsset={setDeletingAsset}
                                        onRemoveFromCurrentGroup={handleRemoveFromCurrentGroup}
                                        onDropAsset={handleDropAsset}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // NORMAL VEYA ÖZEL GRUP LİSTESİ — GERÇEK TABLO DÜZENİ
                    <div>
                        {processedHoldings.length > 0 ? (
                            <HoldingsTable
                                items={processedHoldings}
                                selectedPeriod={selectedPeriod}
                                assetSummaries={assetSummaries}
                                groups={groups}
                                assetGroups={assetGroups}
                                fmt={fmt}
                                activeGroupMetrics={activeGroupMetrics}
                                onQuickAddTx={handleQuickAddTx}
                                onQuickSellTx={handleQuickSellTx}
                                onAssignAsset={setAssigningAsset}
                                onDeleteAsset={setDeletingAsset}
                                onRemoveFromCurrentGroup={handleRemoveFromCurrentGroup}
                                onDropAsset={handleDropAsset}
                            />
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
                    </>
                )}
            </div>

            {/* 6. YENİ GRUP OLUŞTURMA MODALI */}
            <CreateGroupModal
                isOpen={isCreateGroupOpen}
                onClose={() => setIsCreateGroupOpen(false)}
                onCreateGroup={handleCreateGroup}
            />

            {/* 7. HİSSEYİ GRUPLARA ATAMA MODALI */}
            <AssignGroupModal
                isOpen={!!assigningAsset}
                asset={assigningAsset}
                groups={groups}
                assetGroups={assetGroups}
                onClose={() => setAssigningAsset(null)}
                onToggleGroup={toggleAssetInGroup}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            />

            {/* 8. HIZLI İŞLEM EKLEME MODALI */}
            <AddTransactionModal
                isOpen={isTxModalOpen}
                initialSymbol={txModalSymbol}
                initialType={txModalType}
                initialPrice={txModalPrice}
                maxLots={txModalMaxLots}
                onClose={() => setIsTxModalOpen(false)}
                onSuccess={loadData}
            />

            {/* 9. GRUPLARI YÖNET & SIRALA MODALI */}
            <ManageGroupsModal
                isOpen={isManageGroupsOpen}
                groups={groups}
                assetGroups={assetGroups}
                onClose={() => setIsManageGroupsOpen(false)}
                onOpenCreateGroup={() => {
                    setIsManageGroupsOpen(false);
                    setIsCreateGroupOpen(true);
                }}
                onDeleteGroup={handleDeleteGroup}
                onMoveGroup={handleMoveGroup}
                onDropGroup={(draggedId, targetId) => handleDropGroup(targetId, draggedId)}
            />

            {/* 10. DOĞRUDAN PORTFÖYDEN VARLIK SİLME ONAY MODALI */}
            <DeleteAssetModal
                isOpen={!!deletingAsset}
                asset={deletingAsset}
                isSubmitting={deleteSubmitting}
                onClose={() => setDeletingAsset(null)}
                onConfirm={handleConfirmDeleteAsset}
                fmt={fmt}
            />
        </div>
    );
}