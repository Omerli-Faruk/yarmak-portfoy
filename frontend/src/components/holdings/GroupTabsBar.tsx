'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    FolderPlus,
    ChevronLeft,
    ChevronRight,
    Settings2,
    Trash2,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import type { AssetGroup, UserHolding } from '@/types';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

const SCROLL_ARROW =
    'pointer-events-auto flex items-center justify-center size-11 sm:size-10 rounded text-fg-muted cursor-pointer transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

// Alt çizgili sekme: etkin olanın altında mavi çizgi. Aralık sekmeler arasındaki boşlukla verilir.
const tabClasses = (isActive: boolean) =>
    cn(
        'inline-flex items-center gap-1.5 h-11 sm:h-10 px-0.5 shrink-0 border-b-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer',
        'transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        isActive ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
    );

const countClasses = (isActive: boolean) =>
    cn('font-mono text-xs', isActive ? 'text-fg' : 'text-fg-muted');

interface GroupTabsBarProps {
    groups: AssetGroup[];
    assetGroups: Record<string, string[]>;
    holdings: UserHolding[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    isGroupsWrapped: boolean;
    onToggleWrap: () => void;
    isCustomGroup: boolean;
    activeGroupName: string;
    onDeleteActiveGroup: () => void;
    onOpenManage: () => void;
    onOpenCreate: () => void;
    onDropGroup: (targetId: string, sourceId: string) => void;
    className?: string;
}

// Tüm Varlıklar / Türe Göre / kullanıcı grupları sekmeleri ve sağda sade grup işlemleri, tek satırda.
// Sekmeler tek satırda kaydırılabilir ya da alt alta sarılabilir; grup sekmeleri sürükle-bırak ile sıralanır.
export default function GroupTabsBar({
    groups,
    assetGroups,
    holdings,
    activeTab,
    onTabChange,
    isGroupsWrapped,
    onToggleWrap,
    isCustomGroup,
    activeGroupName,
    onDeleteActiveGroup,
    onOpenManage,
    onOpenCreate,
    onDropGroup,
    className,
}: GroupTabsBarProps) {
    const groupsContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

    // Sekmeler sağa ya da sola taşıyor mu
    const checkGroupsScroll = () => {
        const el = groupsContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 6);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
    };

    const scrollGroups = (direction: 'left' | 'right') => {
        const el = groupsContainerRef.current;
        if (!el) return;
        const amount = Math.max(200, el.clientWidth * 0.65);
        el.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth'
        });
    };

    // Tek satır modunda fare tekerleği sekmeleri yatay kaydırır
    const handleGroupsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (isGroupsWrapped) return;
        const el = groupsContainerRef.current;
        if (!el) return;
        if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) {
            el.scrollLeft += e.deltaY;
            checkGroupsScroll();
        }
    };

    const resetDrag = () => {
        setDraggedGroupId(null);
        setDragOverGroupId(null);
    };

    const handleDrop = (targetId: string) => {
        if (draggedGroupId && draggedGroupId !== targetId) {
            onDropGroup(targetId, draggedGroupId);
        }
        resetDrag();
    };

    // Grup sayısı, görünüm ya da pencere boyutu değişince kaydırma oklarını güncelle
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

    // Seçili sekmeyi görünür alana kaydır
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

    return (
        <nav className={cn('flex items-start gap-2 min-w-0', className)} aria-label="Gruplar">
            {/* Sekmeler */}
            <div className="relative flex-1 min-w-0">
                {/* Sol ok: yalnızca tek satır modunda ve sola kaydırılabiliyorsa */}
                {!isGroupsWrapped && canScrollLeft && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pr-1 bg-bg">
                        <button
                            type="button"
                            onClick={() => scrollGroups('left')}
                            className={SCROLL_ARROW}
                            aria-label="Sola kaydır"
                            title="Sola kaydır"
                        >
                            <ChevronLeft className="size-[18px]" />
                        </button>
                    </div>
                )}

                <div
                    ref={groupsContainerRef}
                    onScroll={checkGroupsScroll}
                    onWheel={handleGroupsWheel}
                    className={cn(
                        'flex items-center gap-x-5 touch-pan-x',
                        isGroupsWrapped ? 'flex-wrap' : 'overflow-x-auto no-scrollbar scroll-smooth',
                    )}
                >
                    <button
                        type="button"
                        data-tab-id="all"
                        onClick={() => onTabChange('all')}
                        aria-pressed={activeTab === 'all'}
                        className={tabClasses(activeTab === 'all')}
                    >
                        <span>Tüm varlıklar</span>
                        <span className={countClasses(activeTab === 'all')}>{holdings.length}</span>
                    </button>

                    <button
                        type="button"
                        data-tab-id="by_type"
                        onClick={() => onTabChange('by_type')}
                        aria-pressed={activeTab === 'by_type'}
                        className={tabClasses(activeTab === 'by_type')}
                    >
                        <span>Türe göre</span>
                    </button>

                    {/* Hazır görünümleri kullanıcı gruplarından ayıran ince çizgi */}
                    {groups.length > 0 && <span aria-hidden className="h-4 w-px shrink-0 bg-border" />}

                    {/* Kullanıcı grupları (sürüklenebilir) */}
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
                                    handleDrop(g.id);
                                }}
                                onDragEnd={resetDrag}
                                className={cn(
                                    'relative shrink-0 cursor-grab active:cursor-grabbing',
                                    isDragging && 'opacity-40',
                                    // Bırakılacak yer: solda ince mavi çizgi
                                    isOver && 'before:absolute before:inset-y-2 before:-left-2.5 before:w-0.5 before:bg-primary',
                                )}
                                title="Sırasını değiştirmek için sürükleyip bırakabilirsiniz"
                            >
                                <button
                                    type="button"
                                    onClick={() => onTabChange(g.id)}
                                    aria-pressed={isActive}
                                    className={tabClasses(isActive)}
                                >
                                    {/* Grup rengi kullanıcı verisidir; grubu tanıtan tek işaret */}
                                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                                    <span>{g.name}</span>
                                    <span className={countClasses(isActive)}>{count}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Sağ ok: yalnızca tek satır modunda ve sağda başka grup varsa */}
                {!isGroupsWrapped && canScrollRight && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pl-1 bg-bg">
                        <button
                            type="button"
                            onClick={() => scrollGroups('right')}
                            className={SCROLL_ARROW}
                            aria-label="Sağa kaydır"
                            title="Sağa kaydır"
                        >
                            <ChevronRight className="size-[18px]" />
                        </button>
                    </div>
                )}
            </div>

            {/* Grup işlemleri: silme ve yeni grup masaüstünde yazılı, diğerleri simge (adları ipucu ve ekran okuyucu metninde) */}
            <div className="flex items-center h-11 sm:h-10 shrink-0">
                {isCustomGroup && (
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 />}
                        onClick={onDeleteActiveGroup}
                        aria-label={`"${activeGroupName}" grubunu sil`}
                        title={`"${activeGroupName}" grubunu sil`}
                        className="px-2 hover:bg-loss-soft hover:text-loss"
                    >
                        <span className="hidden sm:inline">Grubu sil</span>
                    </Button>
                )}

                {groups.length > 0 && (
                    <IconButton
                        icon={<Settings2 />}
                        label="Grupları yönet"
                        size="sm"
                        onClick={onOpenManage}
                    />
                )}

                {/* Tek satır / çok satır görünümü */}
                {groups.length > 2 && (
                    <IconButton
                        icon={isGroupsWrapped ? <ChevronUp /> : <ChevronDown />}
                        label={isGroupsWrapped ? 'Tek satırda göster' : 'Tüm grupları göster'}
                        size="sm"
                        aria-pressed={isGroupsWrapped}
                        onClick={onToggleWrap}
                    />
                )}

                <Button variant="ghost" size="sm" leftIcon={<FolderPlus />} onClick={onOpenCreate} aria-label="Yeni grup" className="px-2">
                    <span className="hidden sm:inline">Yeni grup</span>
                </Button>
            </div>
        </nav>
    );
}
