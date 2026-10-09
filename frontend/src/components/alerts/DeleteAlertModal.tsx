'use client';

import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

interface DeleteAlertModalProps {
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteAlertModal({ isDeleting, onCancel, onConfirm }: DeleteAlertModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
            >
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-foreground">Fiyat Alarmını Sil</h4>
                <p className="text-xs text-slate-400 mt-2">
                    Bu alarmı kaldırmak istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white transition text-xs font-semibold cursor-pointer"
                    >
                        İptal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                        {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
