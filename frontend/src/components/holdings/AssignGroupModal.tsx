'use client';

import React from 'react';
import { Check, Plus } from 'lucide-react';
import { AssetGroup, UserHolding } from '@/types';
import { cn } from '@/lib/cn';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface AssignGroupModalProps {
    isOpen: boolean;
    asset: UserHolding | null;
    groups: AssetGroup[];
    assetGroups: Record<string, string[]>;
    onClose: () => void;
    onToggleGroup: (symbol: string, groupId: string) => void;
    onOpenCreateGroup: () => void;
}

export default function AssignGroupModal({
    isOpen,
    asset,
    groups,
    assetGroups,
    onClose,
    onToggleGroup,
    onOpenCreateGroup,
}: AssignGroupModalProps) {
    if (!asset) return null;

    const assigned = assetGroups[asset.symbol] || [];

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={`Gruplara ata: ${asset.symbol}`}
            description={asset.asset_name}
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
            {groups.length > 0 ? (
                <div className="flex flex-col border-y border-border divide-y divide-border">
                    {groups.map(g => {
                        const isAssigned = assigned.includes(g.id);
                        return (
                            <button
                                key={g.id}
                                type="button"
                                role="checkbox"
                                aria-checked={isAssigned}
                                onClick={() => onToggleGroup(asset.symbol, g.id)}
                                className={cn(
                                    'flex w-full h-12 items-center justify-between gap-3 px-3 text-left cursor-pointer',
                                    'transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                                    isAssigned ? 'bg-primary-soft' : 'hover:bg-surface-2',
                                )}
                            >
                                <span className="flex items-center gap-2.5 min-w-0">
                                    {/* Grup rengi kullanıcı verisidir */}
                                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                                    <span className="truncate text-sm text-fg">{g.name}</span>
                                </span>
                                <span
                                    aria-hidden
                                    className={cn(
                                        'flex items-center justify-center size-5 shrink-0 rounded-[3px] border',
                                        isAssigned ? 'bg-primary border-primary text-on-primary' : 'border-border-strong',
                                    )}
                                >
                                    {isAssigned && <Check className="size-4" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <p className="py-4 text-center text-sm text-fg-muted">
                    Henüz oluşturulmuş özel grup yok.
                </p>
            )}
        </Modal>
    );
}
