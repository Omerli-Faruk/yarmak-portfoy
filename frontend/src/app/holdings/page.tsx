'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { UserHolding, Period } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/formatters';
import { useCurrency } from '@/hooks/useCurrency';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { invalidateAssetCache } from '@/lib/assetCache';
import { baseValueFromReturn, isHoldingNewerThanPeriod } from '@/lib/periodUtils';
import TransactionHistoryTab from '@/components/holdings/TransactionHistoryTab';
import DividendsTab from '@/components/holdings/DividendsTab';
import CreateGroupModal from '@/components/holdings/CreateGroupModal';
import AssignGroupModal from '@/components/holdings/AssignGroupModal';
import ManageGroupsModal from '@/components/holdings/ManageGroupsModal';
import AddTransactionModal from '@/components/holdings/AddTransactionModal';
import DeleteAssetModal from '@/components/holdings/DeleteAssetModal';
import HoldingsTable from '@/components/holdings/HoldingsTable';
import HoldingsHeader from '@/components/holdings/HoldingsHeader';
import MainViewTabs, { type MainViewTab } from '@/components/holdings/MainViewTabs';
import PeriodSummaryBar from '@/components/holdings/PeriodSummaryBar';
import GroupTabsBar from '@/components/holdings/GroupTabsBar';
import HoldingsToolbar from '@/components/holdings/HoldingsToolbar';
import { useHoldingsPreferences } from '@/components/holdings/useHoldingsPreferences';

interface TxModalState {
    open: boolean;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: string;
    maxLots?: number;
}

export default function HoldingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const { summary, holdings, assetSummaries, usdRate, loading, refreshing, reload } =
        usePortfolioData(user, { awaitAssetSummaries: true });

    const { currency, toggleCurrency } = useCurrency();

    const [mainViewTab, setMainViewTab] = useState<MainViewTab>('positions');

    // Sekme adres çubuğundan da seçilebilir: ?tab=transactions ya da ?tab=dividends
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

    const changeMainTab = (tab: MainViewTab) => {
        setMainViewTab(tab);
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', tab === 'positions' ? '/holdings' : `/holdings?tab=${tab}`);
        }
    };

    const [selectedPeriod, setSelectedPeriod] = useState<Period>('1D');

    const {
        groups,
        assetGroups,
        sortBy,
        customAssetOrder,
        isGroupsWrapped,
        setSortBy,
        setCustomOrder,
        toggleWrap,
        createGroup,
        deleteGroup,
        toggleAssetInGroup,
        reorderGroups,
        moveGroup,
    } = useHoldingsPreferences(user);

    // Seçili sekme: 'all', 'by_type' ya da bir grup id'si
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
    const [deletingAsset, setDeletingAsset] = useState<UserHolding | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [assigningAsset, setAssigningAsset] = useState<UserHolding | null>(null);
    const [txModal, setTxModal] = useState<TxModalState>({ open: false, symbol: '', type: 'BUY', price: '' });

    const handleQuickAddTx = (symbol: string = '') => {
        setTxModal({ open: true, symbol, type: 'BUY', price: '', maxLots: undefined });
    };

    const handleQuickSellTx = (holding: UserHolding) => {
        setTxModal({
            open: true,
            symbol: holding.symbol,
            type: 'SELL',
            price: holding.current_price ? String(holding.current_price) : '',
            maxLots: holding.total_amount,
        });
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Kur yoksa (usdRate null) formatCurrency USD seçili olsa da TL yazar
    const fmt = (amountTRY: number, showPlusSign: boolean = false): string => formatCurrency(amountTRY, currency, usdRate, showPlusSign);

    const handleCreateGroup = (name: string, color: string) => {
        const newGroup = createGroup(name, color);
        setIsCreateGroupOpen(false);
        setActiveTab(newGroup.id);
    };

    const handleDeleteGroup = (groupId: string) => {
        if (!confirm('Bu grubu silmek istediğinize emin misiniz? (Varlıklarınız silinmez)')) return;
        deleteGroup(groupId);
        if (activeTab === groupId) setActiveTab('all');
    };

    const handleRemoveFromCurrentGroup = (symbol: string) => {
        if (activeTab === 'all' || activeTab === 'by_type') return;
        toggleAssetInGroup(symbol, activeTab);
    };

    const handleConfirmDeleteAsset = async () => {
        if (!deletingAsset) return;
        try {
            setDeleteSubmitting(true);
            await api.delete(`/portfolio/holdings/${encodeURIComponent(deletingAsset.symbol)}`);
            invalidateAssetCache(deletingAsset.symbol);
            setDeletingAsset(null);
            await reload(true);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            alert(error.response?.data?.error || 'Varlık silinirken hata oluştu');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // Sekme, arama ve sıralamaya göre listelenecek varlıklar
    const processedHoldings = useMemo(() => {
        let list = [...holdings];

        if (activeTab !== 'all' && activeTab !== 'by_type') {
            list = list.filter(h => (assetGroups[h.symbol] || []).includes(activeTab));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(h => h.symbol.toLowerCase().includes(q) || h.asset_name.toLowerCase().includes(q));
        }

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

    // Satır sürükle-bırak: görünen listede sırayı değiştirir, görünmeyen varlıkları sona ekler.
    // processedHoldings'i her render'da güncel okuması gerektiği için useCallback'e sarılmadı.
    const handleDropAsset = (draggedSymbol: string, targetSymbol: string) => {
        const visibleSymbols = processedHoldings.map(h => h.symbol);
        const fromIndex = visibleSymbols.indexOf(draggedSymbol);
        const toIndex = visibleSymbols.indexOf(targetSymbol);
        if (fromIndex === -1 || toIndex === -1) return;

        const newVisible = [...visibleSymbols];
        const [moved] = newVisible.splice(fromIndex, 1);
        newVisible.splice(toIndex, 0, moved);

        const otherSymbols = holdings.map(h => h.symbol).filter(s => !newVisible.includes(s));
        setCustomOrder([...newVisible, ...otherSymbols]);
    };

    // Seçili grubun (ya da tüm portföyün) değeri ve seçili dönemdeki K/Z'si
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
            // Dönem başı değeri her varlığın dönem getirisinden geri hesaplanır
            let totalBaseVal = 0;
            let hasAnyValidReturn = false;

            for (const h of targetAssets) {
                const sum = assetSummaries[h.symbol];
                const ret = sum?.[selectedPeriod];
                const retAll = sum?.['ALL'];
                const curVal = h.total_value;
                const costVal = h.average_cost * h.total_amount;

                // Dönem başladıktan sonra alınan varlıkta başlangıç değeri olarak alış maliyeti kullanılır
                const isNewer = isHoldingNewerThanPeriod(h.first_buy_date, selectedPeriod, ret ?? null, retAll ?? null);

                if (isNewer) {
                    hasAnyValidReturn = true;
                    totalBaseVal += costVal > 0 ? costVal : curVal;
                } else if (ret !== undefined && !isNaN(ret) && ret !== 0) {
                    hasAnyValidReturn = true;
                    totalBaseVal += baseValueFromReturn(curVal, ret);
                } else {
                    totalBaseVal += costVal > 0 ? costVal : curVal;
                }
            }

            if (hasAnyValidReturn && totalBaseVal > 0) {
                pnlAmount = totalVal - totalBaseVal;
                pnlPercent = (pnlAmount / totalBaseVal) * 100;
            } else if (!isCustomGroup && summary?.period_returns?.[selectedPeriod] !== undefined && summary.period_returns[selectedPeriod] !== 0) {
                // Varlık bazında getiri yoksa portföyün günlük kayıtlarından gelen getiri kullanılır
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

    // İki tablo kullanımında da aynı olan ayarlar
    const tableProps = {
        selectedPeriod,
        assetSummaries,
        groups,
        assetGroups,
        fmt,
        activeGroupMetrics,
        onQuickAddTx: handleQuickAddTx,
        onQuickSellTx: handleQuickSellTx,
        onAssignAsset: setAssigningAsset,
        onDeleteAsset: setDeletingAsset,
        onRemoveFromCurrentGroup: handleRemoveFromCurrentGroup,
        onDropAsset: handleDropAsset,
    };

    return (
        <div className="min-h-screen text-slate-100 py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                <HoldingsHeader
                    currency={currency}
                    currencyDisabled={usdRate === null}
                    onToggleCurrency={toggleCurrency}
                    onAddTx={() => handleQuickAddTx('')}
                    refreshing={refreshing}
                    onRefresh={() => reload(true)}
                />

                <MainViewTabs tab={mainViewTab} positionsCount={holdings.length} onChange={changeMainTab} />

                {mainViewTab === 'transactions' ? (
                    <TransactionHistoryTab
                        currency={currency}
                        usdRate={usdRate ?? 0}
                        onRefreshHoldings={() => reload(true)}
                        onOpenAddTxModal={() => handleQuickAddTx('')}
                    />
                ) : mainViewTab === 'dividends' ? (
                    <DividendsTab
                        currency={currency}
                        usdRate={usdRate ?? 0}
                        holdings={holdings}
                        onRefreshHoldings={() => reload(true)}
                    />
                ) : (
                    <>
                <PeriodSummaryBar
                    selectedPeriod={selectedPeriod}
                    onPeriodChange={setSelectedPeriod}
                    metrics={activeGroupMetrics}
                    totalDividends={summary?.total_dividends || 0}
                    fmt={fmt}
                />

                <GroupTabsBar
                    groups={groups}
                    assetGroups={assetGroups}
                    holdings={holdings}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isGroupsWrapped={isGroupsWrapped}
                    onToggleWrap={toggleWrap}
                    isCustomGroup={activeGroupMetrics.isCustomGroup}
                    activeGroupName={activeGroupMetrics.groupName}
                    onDeleteActiveGroup={() => handleDeleteGroup(activeTab)}
                    onOpenManage={() => setIsManageGroupsOpen(true)}
                    onOpenCreate={() => setIsCreateGroupOpen(true)}
                    onDropGroup={(targetId, sourceId) => reorderGroups(sourceId, targetId)}
                />

                <HoldingsToolbar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                />

                {activeTab === 'by_type' ? (
                    // Türe göre bölümlenmiş liste
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
                                    <HoldingsTable items={typeList} {...tableProps} />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Tüm varlıklar ya da seçili grup
                    <div>
                        {processedHoldings.length > 0 ? (
                            <HoldingsTable items={processedHoldings} {...tableProps} />
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                                <p className="text-base font-semibold text-white mb-1">Bu grupta veya aramada varlık bulunamadı.</p>
                                <p className="text-xs text-slate-500 mb-4">
                                    {activeTab !== 'all' ? 'Aşağıdaki butona basarak varlıklarınızı bu gruba dahil edebilirsiniz.' : 'Portföyünüze yeni hisse veya fon işlemi ekleyin.'}
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

            <CreateGroupModal
                isOpen={isCreateGroupOpen}
                onClose={() => setIsCreateGroupOpen(false)}
                onCreateGroup={handleCreateGroup}
            />

            <AssignGroupModal
                isOpen={!!assigningAsset}
                asset={assigningAsset}
                groups={groups}
                assetGroups={assetGroups}
                onClose={() => setAssigningAsset(null)}
                onToggleGroup={toggleAssetInGroup}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            />

            <AddTransactionModal
                isOpen={txModal.open}
                initialSymbol={txModal.symbol}
                initialType={txModal.type}
                initialPrice={txModal.price}
                maxLots={txModal.maxLots}
                onClose={() => setTxModal(prev => ({ ...prev, open: false }))}
                onSuccess={() => reload()}
            />

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
                onMoveGroup={moveGroup}
                onDropGroup={reorderGroups}
            />

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
