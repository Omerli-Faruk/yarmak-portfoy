'use client';

import React, { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { AssetGroup } from '@/types';
import { cn } from '@/lib/cn';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

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
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Grupları yönet"
            description="Sırayı değiştirmek için satırı sürükleyin ya da okları kullanın. Gruplar yalnızca bu tarayıcıda saklanır; başka cihazda görünmez."
            footer={
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Plus />}
                        className="sm:mr-auto"
                        onClick={() => {
                            onClose();
                            onOpenCreateGroup();
                        }}
                    >
                        Yeni grup
                    </Button>
                    <Button size="sm" onClick={onClose}>
                        Tamamla
                    </Button>
                </>
            }
        >
            {groups.length === 0 ? (
                <p className="py-4 text-center text-sm text-fg-muted">Henüz oluşturulmuş özel grup yok.</p>
            ) : (
                <div className="flex flex-col border-y border-border divide-y divide-border">
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
                                className={cn(
                                    'relative flex items-center justify-between gap-3 min-h-14 py-1 pl-2 pr-1 select-none transition-colors duration-[120ms] hover:bg-surface-2',
                                    // Bırakılacak yer: üstte 2px mavi çizgi
                                    isOver && 'bg-primary-soft hover:bg-primary-soft before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary',
                                    isDragging && 'opacity-40',
                                )}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="size-4 shrink-0 text-fg-muted" aria-hidden />
                                    {/* Grup rengi kullanıcı verisidir */}
                                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                                    <div className="flex flex-col gap-0.5 min-w-0 leading-tight">
                                        <p className="truncate text-sm font-medium text-fg">{g.name}</p>
                                        <p className="text-xs text-fg-muted"><span className="font-mono">{count}</span> varlık</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                    <IconButton
                                        icon={<ChevronUp />}
                                        label="Yukarı taşı"
                                        size="sm"
                                        disabled={idx === 0}
                                        onClick={() => onMoveGroup(g.id, 'up')}
                                    />
                                    <IconButton
                                        icon={<ChevronDown />}
                                        label="Aşağı taşı"
                                        size="sm"
                                        disabled={idx === groups.length - 1}
                                        onClick={() => onMoveGroup(g.id, 'down')}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        leftIcon={<Trash2 />}
                                        onClick={() => onDeleteGroup(g.id)}
                                        aria-label={`"${g.name}" grubunu sil`}
                                        className="px-2.5 text-loss hover:bg-loss-soft hover:text-loss"
                                    >
                                        <span className="hidden sm:inline">Sil</span>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
