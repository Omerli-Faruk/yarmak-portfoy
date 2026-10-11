'use client';

import React, { useMemo } from 'react';
import { NormalizedTransaction } from '@/types';
import { ASSET_TYPE_LABELS, formatDate } from '@/lib/formatters';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import ListPagination from './ListPagination';

// Tabloda bir sayfada gösterilen işlem sayısı
const ITEMS_PER_PAGE = 25;

interface TxTableProps {
    rows: NormalizedTransaction[];
    hasActiveFilters: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    fmt: (value: number, showPlus?: boolean) => string;
    onEdit: (tx: NormalizedTransaction) => void;
    onDelete: (tx: NormalizedTransaction) => void;
}

// Alış/satış: zeminsiz, renkli yazı (renk tek başına anlam taşımasın diye metin de yazılır)
function TxTypeTag({ isBuy }: { isBuy: boolean }) {
    return (
        <span className={cn('text-sm font-medium', isBuy ? 'text-profit' : 'text-loss')}>
            {isBuy ? 'Alış' : 'Satış'}
        </span>
    );
}

function formatAmount(amount: number): string {
    return amount.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
}

// Kutusuz tablo: başlık zemini sayfa zemini, satırlar 48px ve ince çizgiyle ayrılır
const TH = 'sticky top-0 z-10 h-9 px-3 bg-bg text-xs font-normal text-fg-muted text-left whitespace-nowrap border-b border-border';
const TD = 'h-12 px-3 whitespace-nowrap border-b border-border';

export default function TxTable({
    rows,
    hasActiveFilters,
    currentPage,
    onPageChange,
    fmt,
    onEdit,
    onDelete,
}: TxTableProps) {
    const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));

    const pageRows = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return rows.slice(start, start + ITEMS_PER_PAGE);
    }, [rows, currentPage]);

    // Yeni işlem düğmesi sayfa başlığında ("İşlem ekle"); boş durumda ikinci bir düğme yok
    if (rows.length === 0) {
        return (
            <EmptyState
                icon={<Clock />}
                title="İşlem bulunamadı"
                description={
                    hasActiveFilters
                        ? 'Seçilen filtrelere uygun işlem geçmişi bulunamadı. Filtreleri temizlemeyi deneyin.'
                        : 'Henüz hiç alım veya satım işlemi kaydetmediniz. İlk işleminizi ekleyerek portföyünüzü oluşturun.'
                }
            />
        );
    }

    return (
        <div className="flex flex-col">
            {/* Mobil ve tablet: yığın satırlar */}
            <ul className="flex flex-col border-y border-border divide-y divide-border lg:hidden">
                {pageRows.map((tx, idx) => {
                    const total = tx.amount * tx.price;
                    const isBuy = tx.type === 'BUY';
                    const showPnl = !isBuy && tx.realizedPnl !== 0;

                    return (
                        <li key={tx.id || idx} className="flex flex-col gap-1 py-3">
                            {/* Sembol, tür ve toplam */}
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate font-mono text-sm font-semibold text-fg">{tx.symbol}</span>
                                <TxTypeTag isBuy={isBuy} />
                                <span className="ml-auto shrink-0 font-mono text-sm font-medium text-fg">{fmt(total)}</span>
                            </div>

                            {/* Tür, ad ve tarih */}
                            <div className="flex items-center gap-2 min-w-0 text-xs">
                                <span className="truncate text-fg-muted">
                                    {ASSET_TYPE_LABELS[tx.assetType] ?? tx.assetType}
                                    {tx.assetName ? ` · ${tx.assetName}` : ''}
                                </span>
                                <span className="ml-auto shrink-0 font-mono text-fg-muted">{formatDate(tx.date)}</span>
                            </div>

                            {/* Ayrıntılar ve eylemler */}
                            <div className="flex items-center gap-2">
                                <dl className="flex flex-wrap gap-x-4 gap-y-1 flex-1 min-w-0 text-sm">
                                    <div className="flex gap-1.5">
                                        <dt className="text-fg-muted">Adet</dt>
                                        <dd className="font-mono text-fg">{formatAmount(tx.amount)}</dd>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <dt className="text-fg-muted">Fiyat</dt>
                                        <dd className="font-mono text-fg">{fmt(tx.price)}</dd>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <dt className="text-fg-muted">Komisyon</dt>
                                        <dd className="font-mono text-fg">{fmt(tx.commission)}</dd>
                                    </div>
                                    {showPnl && (
                                        <div className="flex gap-1.5">
                                            <dt className="text-fg-muted">K/Z</dt>
                                            <dd className={cn('font-mono font-medium', tx.realizedPnl >= 0 ? 'text-profit' : 'text-loss')}>
                                                {fmt(tx.realizedPnl, true)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                                <div className="flex items-center shrink-0 -mr-2">
                                    <IconButton icon={<Pencil />} label={`${tx.symbol} işlemini düzenle`} size="sm" onClick={() => onEdit(tx)} />
                                    <IconButton icon={<Trash2 />} label={`${tx.symbol} işlemini sil`} size="sm" onClick={() => onDelete(tx)} />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Geniş ekran: sütunlu veri olduğu için table. Başlık, kayarken üstte sabit kalır.
                Satır hover zemini kenara taşsın diye kap 8px dışarı açılır, ilk/son hücre aynı kadar içeri alınır. */}
            <div className="hidden lg:block -mx-2 max-h-[70vh] overflow-auto custom-scrollbar">
                <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th scope="col" className={cn(TH, 'pl-2')}>Tarih</th>
                            <th scope="col" className={TH}>Varlık</th>
                            <th scope="col" className={TH}>Tür</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Adet</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Fiyat</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Tutar</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Gerçekleşen K/Z</th>
                            <th scope="col" className={cn(TH, 'hidden xl:table-cell text-right')}>Komisyon</th>
                            <th scope="col" className={cn(TH, 'pr-2 text-right')}>
                                <span className="sr-only">Eylemler</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.map((tx, idx) => {
                            const total = tx.amount * tx.price;
                            const isBuy = tx.type === 'BUY';

                            return (
                                <tr key={tx.id || idx} className="transition-colors duration-[120ms] hover:bg-surface-2">
                                    {/* Tarih */}
                                    <td className={cn(TD, 'pl-2 font-mono text-fg-muted')}>
                                        {formatDate(tx.date)}
                                    </td>

                                    {/* Varlık: sembol ve ad tek satırda */}
                                    <td className={TD}>
                                        <div className="flex items-baseline gap-2 min-w-0 max-w-64 xl:max-w-72">
                                            <span className="font-mono font-semibold text-fg">{tx.symbol}</span>
                                            <span className="truncate text-xs text-fg-muted">{tx.assetName}</span>
                                        </div>
                                    </td>

                                    {/* Alış / satış */}
                                    <td className={TD}>
                                        <TxTypeTag isBuy={isBuy} />
                                    </td>

                                    {/* Adet */}
                                    <td className={cn(TD, 'text-right font-mono text-fg')}>
                                        {formatAmount(tx.amount)}
                                    </td>

                                    {/* Birim fiyat */}
                                    <td className={cn(TD, 'text-right font-mono text-fg')}>
                                        {fmt(tx.price)}
                                    </td>

                                    {/* Toplam tutar */}
                                    <td className={cn(TD, 'text-right font-mono font-medium text-fg')}>
                                        {fmt(total)}
                                    </td>

                                    {/* Gerçekleşen kâr/zarar yalnızca satışlarda gösterilir */}
                                    <td className={cn(TD, 'text-right font-mono')}>
                                        {!isBuy && tx.realizedPnl !== 0 ? (
                                            <span className={cn('font-medium', tx.realizedPnl >= 0 ? 'text-profit' : 'text-loss')}>
                                                {fmt(tx.realizedPnl, true)}
                                            </span>
                                        ) : (
                                            <span className="text-fg-muted">—</span>
                                        )}
                                    </td>

                                    {/* Komisyon: yalnızca geniş ekranda */}
                                    <td className={cn(TD, 'hidden xl:table-cell text-right font-mono text-fg-muted')}>
                                        {fmt(tx.commission)}
                                    </td>

                                    {/* Düzenle / sil: masaüstünde yazılı düğmeler */}
                                    <td className={cn(TD, 'pr-0')}>
                                        <div className="flex items-center justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Pencil />}
                                                onClick={() => onEdit(tx)}
                                                aria-label={`${tx.symbol} işlemini düzenle`}
                                                className="px-2.5"
                                            >
                                                Düzenle
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Trash2 />}
                                                onClick={() => onDelete(tx)}
                                                aria-label={`${tx.symbol} işlemini sil`}
                                                className="px-2.5 hover:bg-loss-soft hover:text-loss"
                                            >
                                                Sil
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {rows.length > ITEMS_PER_PAGE && (
                <ListPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={rows.length}
                    pageSize={ITEMS_PER_PAGE}
                    unitLabel="işlemden"
                    onPageChange={onPageChange}
                />
            )}
        </div>
    );
}
