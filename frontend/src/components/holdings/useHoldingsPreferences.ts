'use client';

import { useEffect, useState } from 'react';
import type { AssetGroup, User } from '@/types';
import { HOLDINGS_SORT_OPTIONS, type HoldingsSortType } from './HoldingsToolbar';

// İlk girişte (kayıtlı grup yoksa) oluşturulan gruplar. Renkler tema rengi değil, localStorage'a kaydedilen grup verisidir.
const DEFAULT_GROUPS: AssetGroup[] = [
    { id: 'g_temettu', name: 'Temettü Hisselerim', color: '#10b981' },
    { id: 'g_buyume', name: 'Büyüme Portföyü', color: '#1A9FD3' },
    { id: 'g_uzun', name: 'Uzun Vade', color: '#f59e0b' },
];

const VALID_SORTS = HOLDINGS_SORT_OPTIONS.map(o => o.value) as string[];

// Varlıklarım sayfasının kullanıcıya özel tercihleri: gruplar, varlık-grup eşleşmeleri, sıralama ve
// grup sekmelerinin görünümü. Hepsi yalnızca bu tarayıcıda (localStorage) kullanıcı id'siyle saklanır.
export function useHoldingsPreferences(user: User | null) {
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [assetGroups, setAssetGroups] = useState<Record<string, string[]>>({}); // sembol -> grup id'leri
    const [isGroupsWrapped, setIsGroupsWrapped] = useState(false);
    const [sortBy, setSortByState] = useState<HoldingsSortType>('val_desc');
    const [customAssetOrder, setCustomAssetOrder] = useState<string[]>([]);

    const userKey = () => user?.id || 'default';

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

            if (savedSort && VALID_SORTS.includes(savedSort)) {
                setSortByState(savedSort as HoldingsSortType);
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
                setGroups(DEFAULT_GROUPS);
                localStorage.setItem(`user_groups_${userId}`, JSON.stringify(DEFAULT_GROUPS));
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

    const saveGroups = (newGroups: AssetGroup[], newAssetGroups: Record<string, string[]>) => {
        setGroups(newGroups);
        setAssetGroups(newAssetGroups);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`user_groups_${userKey()}`, JSON.stringify(newGroups));
            localStorage.setItem(`asset_groups_${userKey()}`, JSON.stringify(newAssetGroups));
        }
    };

    const setSortBy = (newSort: HoldingsSortType) => {
        setSortByState(newSort);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`holdings_sort_by_${userKey()}`, newSort);
        }
    };

    // Sürükle-bırak sonrası yeni sırayı kaydeder ve sıralamayı "özel"e alır
    const setCustomOrder = (order: string[]) => {
        setCustomAssetOrder(order);
        setSortByState('custom');
        if (typeof window !== 'undefined') {
            localStorage.setItem(`custom_asset_order_${userKey()}`, JSON.stringify(order));
            localStorage.setItem(`holdings_sort_by_${userKey()}`, 'custom');
        }
    };

    const toggleWrap = () => {
        const next = !isGroupsWrapped;
        setIsGroupsWrapped(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`user_groups_wrap_${userKey()}`, next ? 'true' : 'false');
        }
    };

    const createGroup = (name: string, color: string): AssetGroup => {
        const newGroup: AssetGroup = {
            id: 'grp_' + Date.now(),
            name: name.trim(),
            color,
        };
        saveGroups([...groups, newGroup], assetGroups);
        return newGroup;
    };

    // Grubu ve tüm varlıklardaki eşleşmesini siler; varlıkların kendisine dokunmaz
    const deleteGroup = (groupId: string) => {
        const updatedGroups = groups.filter(g => g.id !== groupId);
        const updatedAssetGroups = { ...assetGroups };
        Object.keys(updatedAssetGroups).forEach(sym => {
            updatedAssetGroups[sym] = updatedAssetGroups[sym].filter(id => id !== groupId);
        });
        saveGroups(updatedGroups, updatedAssetGroups);
    };

    const toggleAssetInGroup = (symbol: string, groupId: string) => {
        const currentGroups = assetGroups[symbol] || [];
        const updated = currentGroups.includes(groupId)
            ? currentGroups.filter(id => id !== groupId)
            : [...currentGroups, groupId];
        saveGroups(groups, { ...assetGroups, [symbol]: updated });
    };

    // Sürüklenen grubu hedef grubun yerine taşır
    const reorderGroups = (sourceId: string, targetId: string) => {
        if (!sourceId || sourceId === targetId) return;
        const fromIndex = groups.findIndex(g => g.id === sourceId);
        const toIndex = groups.findIndex(g => g.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const updated = [...groups];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        saveGroups(updated, assetGroups);
    };

    const moveGroup = (groupId: string, direction: 'up' | 'down') => {
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

    return {
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
    };
}
