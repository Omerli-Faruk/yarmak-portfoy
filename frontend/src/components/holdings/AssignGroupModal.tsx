'use client';

import React from 'react';
import { X, Check } from 'lucide-react';
import { AssetGroup, UserHolding } from '@/types';

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
    if (!isOpen || !asset) return null;

    const assigned = assetGroups[asset.symbol] || [];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                        <h3 className="text-base font-bold text-white">Gruplara Ata: {asset.symbol}</h3>
                        <p className="text-xs text-slate-400">{asset.asset_name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {groups.length > 0 ? (
                        groups.map(g => {
                            const isAssigned = assigned.includes(g.id);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => onToggleGroup(asset.symbol, g.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                                        isAssigned
                                            ? 'bg-[#1A9FD3]/15 border-[#1A9FD3]/40 text-white'
                                            : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: g.color }}
                                        />
                                        <span className="text-xs font-bold text-slate-200">{g.name}</span>
                                    </div>
                                    <div
                                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                            isAssigned
                                                ? 'bg-[#1A9FD3] border-[#1A9FD3] text-white'
                                                : 'border-slate-700'
                                        }`}
                                    >
                                        {isAssigned && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <p className="text-xs text-slate-500 text-center py-4">
                            Henüz oluşturulmuş özel grup yok.
                        </p>
                    )}
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
