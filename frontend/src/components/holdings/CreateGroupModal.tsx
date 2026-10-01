'use client';

import React, { useState } from 'react';
import { FolderPlus, X, Check } from 'lucide-react';

const AVAILABLE_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#ef4444', // Red
];

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, color: string) => void;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    onCreateGroup,
}: CreateGroupModalProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(AVAILABLE_COLORS[0]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreateGroup(name.trim(), color);
        setName('');
        setColor(AVAILABLE_COLORS[0]);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-[#1A9FD3]" />
                        Yeni Grup Oluştur
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Grup Adı
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="örn. Temettü Portföyüm, Teknoloji, Uzun Vade"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1A9FD3]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Grup Rengi
                        </label>
                        <div className="flex items-center gap-3">
                            {AVAILABLE_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-7 h-7 rounded-full transition flex items-center justify-center cursor-pointer ${
                                        color === c
                                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                                            : 'opacity-80 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: c }}
                                >
                                    {color === c && <Check className="w-4 h-4 text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
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
    );
}
