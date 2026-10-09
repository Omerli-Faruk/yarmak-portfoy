'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    Layers,
    FolderPlus,
    ChevronLeft,
    ChevronRight,
    Settings2,
    Trash2,
    ChevronUp,
    ChevronDown,
    GripVertical,
} from 'lucide-react';
import type { AssetGroup, UserHolding } from '@/types';

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
}

// Tüm Varlıklar / Türe Göre / kullanıcı grupları sekmeleri. Sekmeler tek satırda kaydırılabilir ya da
// alt alta sarılabilir; grup sekmeleri sürükle-bırak ile sıralanır.
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
                    {isCustomGroup && (
                        <button
                            onClick={onDeleteActiveGroup}
                            className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-white transition cursor-pointer bg-rose-500/10 hover:bg-rose-600 px-3 py-1.5 rounded-xl border border-rose-500/25 active:scale-95"
                            title={`"${activeGroupName}" Grubunu Sil`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Grubu Sil</span>
                        </button>
                    )}

                    {groups.length > 0 && (
                        <button
                            onClick={onOpenManage}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95"
                            title="Grupların Sırasını Değiştir & Yönet"
                        >
                            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Grupları Yönet</span>
                        </button>
                    )}

                    {/* Tek satır / çok satır görünümü */}
                    {groups.length > 2 && (
                        <button
                            type="button"
                            onClick={onToggleWrap}
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
                        onClick={onOpenCreate}
                        className="flex items-center gap-1 text-xs font-bold text-white transition cursor-pointer bg-[#1A9FD3] hover:bg-[#0C6991] px-3 py-1.5 rounded-xl border border-[#1A9FD3]/30 shadow-sm shadow-[#1A9FD3]/20"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ Yeni Grup</span>
                    </button>
                </div>
            </div>

            <div className="relative group/tabs">
                {/* Sol ok: yalnızca tek satır modunda ve sola kaydırılabiliyorsa */}
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
                    <button
                        data-tab-id="all"
                        onClick={() => onTabChange('all')}
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

                    <button
                        data-tab-id="by_type"
                        onClick={() => onTabChange('by_type')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                            activeTab === 'by_type'
                                ? 'bg-[#1A9FD3] hover:bg-[#0C6991] text-white shadow-sm shadow-[#1A9FD3]/20'
                                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-[#1A9FD3]/50 hover:bg-[#1A9FD3]/20'
                        }`}
                    >
                        <span>Türe Göre Grupla</span>
                    </button>

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
                                className={`transition-all duration-150 shrink-0 cursor-grab active:cursor-grabbing rounded-xl ${
                                    isDragging ? 'opacity-30 scale-95' : ''
                                } ${isOver ? 'ring-2 ring-[#1A9FD3] ring-offset-2 ring-offset-slate-900' : ''}`}
                                title="Sırasını değiştirmek için sürükleyip bırakabilirsiniz"
                            >
                                <button
                                    onClick={() => onTabChange(g.id)}
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

                {/* Sağ ok: yalnızca tek satır modunda ve sağda başka grup varsa */}
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
    );
}
