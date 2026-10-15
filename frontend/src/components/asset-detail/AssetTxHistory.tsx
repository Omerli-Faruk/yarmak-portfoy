'use client';

import { Clock, History, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, formatTRY } from '@/lib/formatters';
import Section from '@/components/ui/Section';
import Button from '@/components/ui/Button';
import ChangePill from '@/components/ui/ChangePill';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import type { NormalizedTransaction } from '@/types';
import { tableHeadRowClasses } from '@/components/ui/tableStyles';

// Geniş alan tablosunun sütunları; başlık ve satırlar aynı sınıfları kullanır
const TX_COL = {
    date: 'w-32 shrink-0',
    type: 'flex-1 min-w-12',
    amount: 'w-20 shrink-0 text-right',
    price: 'w-28 shrink-0 text-right',
    commission: 'w-28 shrink-0 text-right',
    total: 'w-32 shrink-0 text-right',
    pnl: 'w-32 shrink-0 text-right',
    action: 'w-16 shrink-0',
} as const;

interface AssetTxHistoryProps {
    isLoggedIn: boolean;
    transactions: NormalizedTransaction[];
    onDelete: (id: number) => void;
    className?: string;
}

// Kullanıcının bu varlıktaki işlemleri. Misafire hesap açma notu gösterilir; "Hesap oluştur" ve
// "İşlem ekle" düğmeleri fiyatın yanında olduğu için boş durumda tekrar edilmez.
// Bölüm yeterince genişse (container query) tek satırlık tablo, dar alanda iki satırlık yığın satır.
// Genişlik ekrana değil sütuna bağlı: yanda temel veriler varken ana sütun daralır.
export default function AssetTxHistory({ isLoggedIn, transactions, onDelete, className }: AssetTxHistoryProps) {
    const hasRows = isLoggedIn && transactions.length > 0;

    return (
        <Section
            title={
                <>
                    İşlemleriniz
                    {hasRows && <span className="ml-2 font-mono text-base font-normal text-fg-muted">{transactions.length}</span>}
                </>
            }
            className={className}
        >
            {!isLoggedIn ? (
                <EmptyState
                    icon={<History />}
                    title="İşlem geçmişinizi görmek için ücretsiz hesap açın."
                    className="border-y border-border"
                />
            ) : transactions.length === 0 ? (
                <EmptyState
                    icon={<Clock />}
                    title="Henüz işlem geçmişi yok."
                    className="border-y border-border"
                />
            ) : (
                <div className="@container flex flex-col">
                    {/* Sütun başlıkları (dar alanda gizli); sağdaki boşluk silme düğmesinin yeri.
                        Sayı sütunları sabit genişlikte ve küçülmez, böylece başlık ve satırlar aynı hizada kalır;
                        toplamları (aralarla) @3xl (768px) içine sığar, artan yer tür sütununa kalır. */}
                    <div className={tableHeadRowClasses('hidden @3xl:flex gap-3')}>
                        <span className={TX_COL.date}>Tarih</span>
                        <span className={TX_COL.type}>Tür</span>
                        <span className={TX_COL.amount}>Adet</span>
                        <span className={TX_COL.price}>Fiyat</span>
                        <span className={cn(TX_COL.commission, 'hidden @4xl:block')}>Komisyon</span>
                        <span className={TX_COL.total}>Tutar</span>
                        <span className={TX_COL.pnl}>Gerçekleşen K/Z</span>
                        <span className={TX_COL.action} aria-hidden />
                    </div>

                    <ul className="flex flex-col border-b border-border divide-y divide-border">
                        {transactions.map((tx) => {
                            const isBuy = tx.type === 'BUY';
                            const subtotal = tx.amount * tx.price;
                            // Alışta komisyon tutara eklenir, satışta hesaba geçen tutardan düşülür
                            const totalWithComm = isBuy ? subtotal + tx.commission : subtotal - tx.commission;
                            const hasPnl = tx.type === 'SELL' && tx.realizedPnl !== 0;
                            const commissionText = `${isBuy ? '+' : '−'}${formatTRY(tx.commission)}`;
                            const typeLabel = (
                                <span className={cn('text-sm font-medium', isBuy ? 'text-profit' : 'text-loss')}>
                                    {isBuy ? 'Alış' : 'Satış'}
                                </span>
                            );

                            return (
                                <li
                                    key={tx.id}
                                    className="px-3 rounded transition-colors duration-[120ms] hover:bg-surface-2"
                                >
                                    {/* Dar alan: üstte tür, adet × fiyat ve toplam; altta tarih ve kâr/zarar */}
                                    <div className="flex @3xl:hidden items-center gap-3 py-3">
                                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="flex items-baseline gap-2 min-w-0">
                                                    {typeLabel}
                                                    <span className="font-mono text-sm text-fg truncate">
                                                        {tx.amount.toLocaleString('tr-TR')} × {formatTRY(tx.price, 4)}
                                                    </span>
                                                </span>
                                                <span className="font-mono text-sm font-medium text-fg whitespace-nowrap">{formatTRY(totalWithComm)}</span>
                                            </div>
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="font-mono text-xs text-fg-muted truncate">{formatDate(tx.date)}</span>
                                                {hasPnl && (
                                                    <ChangePill value={tx.realizedPnl}>{formatTRY(tx.realizedPnl, 2, true)}</ChangePill>
                                                )}
                                            </div>
                                            {tx.commission > 0 && (
                                                <span className="text-xs text-fg-muted">
                                                    Komisyon:{' '}
                                                    <span className="font-mono text-fg">{commissionText}</span>
                                                </span>
                                            )}
                                        </div>
                                        <IconButton
                                            icon={<Trash2 />}
                                            label={`${formatDate(tx.date)} tarihli işlemi sil`}
                                            size="sm"
                                            onClick={() => onDelete(tx.id)}
                                            className="shrink-0 -mr-2 hover:text-loss"
                                        />
                                    </div>

                                    {/* Geniş alan: tek satır; silme düğmesi yazılı ve hep görünür */}
                                    <div className="hidden @3xl:flex items-center gap-3 h-12">
                                        <span className={cn(TX_COL.date, 'font-mono text-sm text-fg-muted truncate')}>{formatDate(tx.date)}</span>
                                        <span className={TX_COL.type}>{typeLabel}</span>
                                        <span className={cn(TX_COL.amount, 'font-mono text-sm text-fg truncate')}>
                                            {tx.amount.toLocaleString('tr-TR')}
                                        </span>
                                        <span className={cn(TX_COL.price, 'font-mono text-sm text-fg truncate')}>
                                            {formatTRY(tx.price, 4)}
                                        </span>
                                        <span className={cn(TX_COL.commission, 'hidden @4xl:block font-mono text-sm text-fg-muted truncate')}>
                                            {tx.commission > 0 ? commissionText : '—'}
                                        </span>
                                        <span
                                            className={cn(TX_COL.total, 'font-mono text-sm font-medium text-fg truncate')}
                                            title={tx.commission > 0 ? `Komisyon: ${commissionText}` : undefined}
                                        >
                                            {formatTRY(totalWithComm)}
                                        </span>
                                        <span className={cn(TX_COL.pnl, 'flex justify-end')}>
                                            {hasPnl ? (
                                                <ChangePill value={tx.realizedPnl}>{formatTRY(tx.realizedPnl, 2, true)}</ChangePill>
                                            ) : (
                                                <span className="font-mono text-sm text-fg-muted">—</span>
                                            )}
                                        </span>
                                        <span className={cn(TX_COL.action, 'flex justify-end')}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Trash2 />}
                                                onClick={() => onDelete(tx.id)}
                                                aria-label={`${formatDate(tx.date)} tarihli işlemi sil`}
                                                className="px-2.5 -mr-2.5 hover:bg-loss-soft hover:text-loss"
                                            >
                                                Sil
                                            </Button>
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </Section>
    );
}
