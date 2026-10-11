'use client';

import React, { useId, useState } from 'react';
import { NormalizedTransaction, Transaction } from '@/types';
import api from '@/lib/api';
import { formatTRY } from '@/lib/formatters';
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/cn';

interface EditTransactionModalProps {
    tx: NormalizedTransaction;
    onClose: () => void;
    // Kayıt başarılı olunca güncellenen alanlar listeye işlenmek üzere üst bileşene verilir
    onSaved: (txId: number, patch: Partial<Transaction>) => void;
}

// datetime-local alanı yerel saat bekler. toISOString UTC verdiği için tarih elle "YYYY-MM-DDTHH:mm" olarak kurulur.
function toLocalInputValue(value: string): string {
    const parsed = value ? new Date(value) : new Date();
    const d = isNaN(parsed.getTime()) ? new Date() : parsed;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FORM_ID = 'edit-transaction-form';

export default function EditTransactionModal({ tx, onClose, onSaved }: EditTransactionModalProps) {
    // Bileşen her işlem için key ile yeniden kurulduğundan başlangıç değerleri doğrudan kayıttan alınır
    const [editType, setEditType] = useState<'BUY' | 'SELL'>(tx.type === 'SELL' ? 'SELL' : 'BUY');
    const [editAmount, setEditAmount] = useState(tx.amount ? String(tx.amount) : '');
    const [editPrice, setEditPrice] = useState(tx.price ? String(tx.price) : '');
    const [editDate, setEditDate] = useState(() => toLocalInputValue(tx.date));
    const [editCommission, setEditCommission] = useState(String(tx.commission));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ids = useId();
    const typeLabelId = `${ids}-type`;
    const amountId = `${ids}-amount`;
    const priceId = `${ids}-price`;
    const commissionId = `${ids}-commission`;
    const dateId = `${ids}-date`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tx.id) return;

        const amountNum = parseFloat(editAmount);
        const priceNum = parseFloat(editPrice);
        const commNum = parseFloat(editCommission) || 0;

        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Lütfen geçerli bir işlem adedi girin.');
            return;
        }
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Lütfen geçerli bir birim fiyat girin.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Alandaki değer yerel saattir; sunucuya UTC olarak gönderilir
            const isoDate = new Date(editDate).toISOString();
            const res = await api.put<Transaction>(`/transactions/${tx.id}`, {
                type: editType,
                amount: amountNum,
                price: priceNum,
                transaction_date: isoDate,
                commission: commNum,
            });

            onSaved(tx.id, {
                ...res.data,
                Type: editType,
                type: editType,
                Amount: String(amountNum),
                amount: String(amountNum),
                Price: String(priceNum),
                price: String(priceNum),
                TransactionDate: isoDate,
                transaction_date: isoDate,
                Commission: String(commNum),
                commission: String(commNum),
            });
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: string; message?: string } } };
            const msg = apiError.response?.data?.error || apiError.response?.data?.message || 'İşlem güncellenemedi. Lütfen değerleri kontrol edin.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Seçili tür çizgisi ve yazısı yeşil/kırmızı olur; metin ve ok simgesi de türü belirtir
    const typeButtonClass = (active: boolean, tone: 'profit' | 'loss') =>
        cn(
            'flex flex-1 items-center justify-center gap-1.5 h-11 sm:h-10 rounded border text-sm font-medium cursor-pointer [&_svg]:size-4',
            'transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            active
                ? tone === 'profit'
                    ? 'bg-profit-soft text-profit border-profit'
                    : 'bg-loss-soft text-loss border-loss'
                : 'bg-surface-2 text-fg-muted border-border hover:text-fg hover:border-border-strong',
        );

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="flex flex-wrap items-baseline gap-2">
                    <span>İşlemi düzenle</span>
                    <span className="font-mono text-base font-medium text-fg-muted">{tx.symbol}</span>
                </span>
            }
            description={tx.assetName}
            size="lg"
            dismissible={!submitting}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Vazgeç
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        loading={submitting}
                    >
                        {submitting ? 'Güncelleniyor...' : 'Kaydet'}
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Alış / satış */}
                <div className="flex flex-col gap-1">
                    <span id={typeLabelId} className="text-13 font-medium text-fg">
                        İşlem türü
                    </span>
                    <div role="group" aria-labelledby={typeLabelId} className="flex gap-2">
                        <button
                            type="button"
                            aria-pressed={editType === 'BUY'}
                            onClick={() => setEditType('BUY')}
                            className={typeButtonClass(editType === 'BUY', 'profit')}
                        >
                            <ArrowDownRight />
                            <span>Alış</span>
                        </button>
                        <button
                            type="button"
                            aria-pressed={editType === 'SELL'}
                            onClick={() => setEditType('SELL')}
                            className={typeButtonClass(editType === 'SELL', 'loss')}
                        >
                            <ArrowUpRight />
                            <span>Satış</span>
                        </button>
                    </div>
                </div>

                {/* Adet ve birim fiyat. Fiyat her zaman TL olarak kaydedilir. */}
                <div className="flex gap-3">
                    <Field label="Adet (lot)" htmlFor={amountId} className="flex-1">
                        <Input
                            id={amountId}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            required
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            placeholder="0"
                        />
                    </Field>
                    <Field label="Birim fiyat (₺)" htmlFor={priceId} className="flex-1">
                        <Input
                            id={priceId}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            required
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="0.00"
                        />
                    </Field>
                </div>

                {/* Girilen adet ve fiyata göre toplam: kutusuz etiket/değer satırı */}
                <div className="flex items-center justify-between gap-3 py-2 border-y border-border">
                    <span className="text-sm text-fg-muted">İşlem tutarı</span>
                    <span className="font-mono text-base font-medium text-fg">
                        {formatTRY((parseFloat(editAmount) || 0) * (parseFloat(editPrice) || 0))}
                    </span>
                </div>

                {/* Komisyon ve tarih */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Field label="Komisyon (₺)" htmlFor={commissionId} className="flex-1">
                        <Input
                            id={commissionId}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={editCommission}
                            onChange={(e) => setEditCommission(e.target.value)}
                            placeholder="0.00"
                        />
                    </Field>
                    <Field label="Tarih ve saat" htmlFor={dateId} className="flex-1">
                        <Input
                            id={dateId}
                            type="datetime-local"
                            required
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="font-mono"
                        />
                    </Field>
                </div>

                {error && (
                    <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2 text-sm text-loss">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
            </form>
        </Modal>
    );
}
