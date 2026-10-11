'use client';

import React from 'react';
import { NormalizedTransaction } from '@/types';
import { formatDate } from '@/lib/formatters';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface DeleteTransactionModalProps {
    tx: NormalizedTransaction;
    fmt: (value: number, showPlus?: boolean) => string;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-sm text-fg-muted">{label}</dt>
            <dd className="min-w-0 text-right font-mono text-sm text-fg break-words">{children}</dd>
        </div>
    );
}

export default function DeleteTransactionModal({
    tx,
    fmt,
    submitting,
    error,
    onCancel,
    onConfirm,
}: DeleteTransactionModalProps) {
    const isBuy = tx.type === 'BUY';

    return (
        <Modal
            open
            onClose={onCancel}
            title="İşlemi sil"
            description="Bu işlem geri alınamaz."
            icon={<AlertTriangle />}
            iconTone="loss"
            size="md"
            dismissible={!submitting}
            footer={
                <>
                    <Button variant="secondary" onClick={onCancel} disabled={submitting}>
                        Vazgeç
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        loading={submitting}
                        leftIcon={<Trash2 />}
                    >
                        {submitting ? 'Siliniyor...' : 'Evet, sil'}
                    </Button>
                </>
            }
        >
            {/* Kutusuz özet: ince çizgilerle ayrılmış etiket/değer satırları */}
            <dl className="flex flex-col border-y border-border divide-y divide-border">
                <SummaryRow label="Varlık">
                    <span className="font-semibold">{tx.symbol}</span> <span className="font-sans text-fg-muted">{tx.assetName}</span>
                </SummaryRow>
                <SummaryRow label="Tür">
                    <span className={cn('font-sans font-medium', isBuy ? 'text-profit' : 'text-loss')}>
                        {isBuy ? 'Alış' : 'Satış'}
                    </span>
                </SummaryRow>
                <SummaryRow label="Adet">{tx.amount.toLocaleString('tr-TR')}</SummaryRow>
                <SummaryRow label="Birim fiyat">{fmt(tx.price)}</SummaryRow>
                <SummaryRow label="Tarih">{formatDate(tx.date)}</SummaryRow>
            </dl>

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2 text-sm text-loss">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </Modal>
    );
}
