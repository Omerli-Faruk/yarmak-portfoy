'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface DeleteDividendModalProps {
    symbol: string;
    netAmount: number;
    fmt: (value: number, showPlus?: boolean) => string;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteDividendModal({
    symbol,
    netAmount,
    fmt,
    submitting,
    error,
    onCancel,
    onConfirm,
}: DeleteDividendModalProps) {
    return (
        <Modal
            open
            onClose={onCancel}
            title="Temettüyü sil"
            icon={<AlertTriangle />}
            iconTone="loss"
            size="md"
            dismissible={!submitting}
            footer={
                <>
                    <Button variant="secondary" onClick={onCancel} disabled={submitting}>
                        Vazgeç
                    </Button>
                    <Button variant="danger" onClick={onConfirm} loading={submitting}>
                        {submitting ? 'Siliniyor...' : 'Evet, sil'}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-fg leading-relaxed">
                <strong className="font-mono font-medium text-fg">{symbol}</strong> hissesine ait{' '}
                <strong className="font-mono font-medium text-profit">{fmt(netAmount)}</strong> tutarındaki
                temettü kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2 text-sm text-loss">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </Modal>
    );
}
