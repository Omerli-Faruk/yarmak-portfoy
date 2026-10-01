'use client';

import React, { useState } from 'react';
import { Settings2, X, GripVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { AssetGroup } from '@/types';

interface ManageGroupsModalProps {
    isOpen: boolean;
    groups: AssetGroup[];
    assetGroups: Record<string, string[]>;
    onClose: () => void;
    onOpenCreateGroup: () => void;
    onDeleteGroup: (groupId: string) => void;
    onMoveGroup: (groupId: string, direction: 'up' | 'down') => void;
    onDropGroup: (draggedId: string, targetId: string) => void;
}

export default function ManageGroupsModal({
    isOpen,
    groups,
    assetGroups,
    onClose,
    onOpenCreateGroup,
    onDeleteGroup,
    onMoveGroup,
    onDropGroup,
}: ManageGroupsModalProps) {
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleDrop = (targetGroupId: string) => {
        if (!draggedGroupId || draggedGroupId === targetGroupId) {
            setDraggedGroupId(null);
            setDragOverGroupId(null);
            return;
        }
        onDropGroup(draggedGroupId, targetGroupId);
        setDraggedGroupId(null);
        setDragOverGroupId(null);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-[#1A9FD3]" />
                        Grupları Yönet ve Sırala
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-xs text-slate-400">
                    Grupların sekme sırasını değiştirmek için tutamaktan tutup sürükleyebilir veya ok butonlarını kullanabilirsiniz.
                </p>

                <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {groups.map((g, idx) => {
                        const count = Object.values(assetGroups).filter(arr => arr.includes(g.id)).length;
                        const isDragging = draggedGroupId === g.id;
                        const isOver = dragOverGroupId === g.id;

                        return (
                            <div
                                key={g.id}
                                draggable
                                onDragStart={e => {
                                    e.dataTransfer.setData('text/plain', g.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedGroupId(g.id);
                                }}
                                onDragOver={e => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverGroupId !== g.id) setDragOverGroupId(g.id);
                                }}
                                onDragLeave={() => {
                                    if (dragOverGroupId === g.id) setDragOverGroupId(null);
                                }}
                                onDrop={e => {
                                    e.preventDefault();
                                    handleDrop(g.id);
                                }}
                                onDragEnd={() => {
                                    setDraggedGroupId(null);
                                    setDragOverGroupId(null);
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 transition select-none ${
                                    isDragging ? 'opacity-30' : ''
                                } ${isOver ? 'border-[#1A9FD3] bg-[#1A9FD3]/15' : ''}`}
                            >
                                <div className="flex items-center gap-2.5 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4 text-slate-500 hover:text-white" />
                                    <span
                                        className="w-3.5 h-3.5 rounded-full shrink-0"
                                        style={{ backgroundColor: g.color }}
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-white">{g.name}</p>
                                        <p className="text-xs text-slate-400">{count} varlık kayıtlı</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {/* Yukarı Taşı */}
                                    <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => onMoveGroup(g.id, 'up')}
                                        className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        title="Yukarı Taşı"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>

                                    {/* Aşağı Taşı */}
                                    <button
                                        type="button"
                                        disabled={idx === groups.length - 1}
                                        onClick={() => onMoveGroup(g.id, 'down')}
                                        className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        title="Aşağı Taşı"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>

                                    {/* Grubu Sil */}
                                    <button
                                        type="button"
                                        onClick={() => onDeleteGroup(g.id)}
                                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition ml-1 cursor-pointer"
                                        title="Grubu Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onOpenCreateGroup();
                        }}
                        className="text-xs font-bold text-[#1A9FD3] hover:underline cursor-pointer"
                    >
                        + Yeni Grup Ekle
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1A9FD3] hover:bg-[#0C6991] text-white transition shadow-sm shadow-[#1A9FD3]/20 cursor-pointer"
                    >
                        Tamamla
                    </button>
                </div>
            </div>
        </div>
    );
}
