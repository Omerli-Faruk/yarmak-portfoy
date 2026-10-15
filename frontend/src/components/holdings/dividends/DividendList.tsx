'use client';

import React from 'react';
import { Dividend, NormalizedDividend } from '@/types';
import { formatDateOnly } from '@/lib/formatters';
import { Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import { TABLE_TH } from '@/components/ui/tableStyles';

// Normalize edilmiş satır; düzenleme modalı ham kaydı beklediği için o da saklanır
export interface DividendRow extends NormalizedDividend {
    raw: Dividend;
}

interface DividendListProps {
    rows: DividendRow[];
    fmt: (value: number, showPlus?: boolean) => string;
    onEdit: (dividend: Dividend) => void;
    onDelete: (row: DividendRow) => void;
}

// Stopaj oranı kayıttaki brüt ve stopaj tutarından hesaplanır. Brüt tutar yoksa oran gösterilmez.
function taxRateLabel(gross: number, tax: number): string {
    return gross > 0 ? `%${Math.round((tax / gross) * 100)}` : '—';
}

// Kutusuz tablo: başlık hafif zeminli bant (tableStyles), satırlar 48px ve ince çizgiyle ayrılır
const TH = cn(TABLE_TH, 'text-left');
const TD = 'h-12 px-3 whitespace-nowrap border-b border-border';

export default function DividendList({ rows, fmt, onEdit, onDelete }: DividendListProps) {
    return (
        <>
            {/* Mobil: yığın satırlar */}
            <ul className="flex flex-col border-y border-border divide-y divide-border md:hidden">
                {rows.map((div, idx) => (
                    <li key={div.id || idx} className="flex flex-col gap-1 py-3">
                        {/* Sembol ve net tutar */}
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-mono text-sm font-semibold text-fg">{div.symbol || '—'}</span>
                            <span className="ml-auto shrink-0 font-mono text-sm font-medium text-profit">
                                <span className="sr-only">Net: </span>+{fmt(div.net)}
                            </span>
                        </div>

                        {/* Şirket adı ve tarih */}
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                            {div.assetName && <span className="truncate text-fg-muted">{div.assetName}</span>}
                            <span className="ml-auto shrink-0 font-mono text-fg-muted">{formatDateOnly(div.date)}</span>
                        </div>

                        {/* Brüt, stopaj ve eylemler */}
                        <div className="flex items-center gap-2">
                            <dl className="flex flex-wrap gap-x-4 gap-y-1 flex-1 min-w-0 text-sm">
                                <div className="flex gap-1.5">
                                    <dt className="text-fg-muted">Brüt</dt>
                                    <dd className="font-mono text-fg">{fmt(div.gross)}</dd>
                                </div>
                                <div className="flex gap-1.5">
                                    <dt className="text-fg-muted">Stopaj ({taxRateLabel(div.gross, div.tax)})</dt>
                                    <dd className="font-mono text-fg">−{fmt(div.tax)}</dd>
                                </div>
                            </dl>
                            <div className="flex items-center shrink-0 -mr-2">
                                <IconButton icon={<Pencil />} label={`${div.symbol} temettüsünü düzenle`} size="sm" onClick={() => onEdit(div.raw)} />
                                <IconButton icon={<Trash2 />} label={`${div.symbol} temettüsünü sil`} size="sm" onClick={() => onDelete(div)} />
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Tablet ve masaüstü: sütunlu veri olduğu için table. Başlık, kayarken üstte sabit kalır.
                Satır hover zemini kenara taşsın diye kap 8px dışarı açılır, ilk/son hücre aynı kadar içeri alınır. */}
            <div className="hidden md:block max-h-[70vh] overflow-auto custom-scrollbar">
                <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th scope="col" className={cn(TH, 'pl-2')}>Ödeme tarihi</th>
                            <th scope="col" className={TH}>Hisse</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Brüt</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Stopaj</th>
                            <th scope="col" className={cn(TH, 'text-right')}>Hesaba yatan net</th>
                            <th scope="col" className={cn(TH, 'pr-2 text-right')}>
                                <span className="sr-only">Eylemler</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((div, idx) => (
                            <tr key={div.id || idx} className="transition-colors duration-[120ms] hover:bg-surface-2">
                                <td className={cn(TD, 'pl-2 font-mono text-fg-muted')}>
                                    {formatDateOnly(div.date)}
                                </td>
                                <td className={TD}>
                                    <div className="flex items-baseline gap-2 min-w-0 max-w-56 lg:max-w-80">
                                        <span className="font-mono font-semibold text-fg">{div.symbol || '—'}</span>
                                        {div.assetName && (
                                            <span className="truncate text-xs text-fg-muted">{div.assetName}</span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn(TD, 'text-right font-mono text-fg')}>
                                    {fmt(div.gross)}
                                </td>
                                <td className={cn(TD, 'text-right font-mono')}>
                                    {/* Tutar önce, oran sonra; oran sabit genişlikte ve aynı boyda, tutarlar alt alta hizalı */}
                                    <span className="text-fg">−{fmt(div.tax)}</span>
                                    <span className="inline-block w-12 text-fg-muted">
                                        {taxRateLabel(div.gross, div.tax)}
                                    </span>
                                </td>
                                <td className={cn(TD, 'text-right font-mono font-medium text-profit')}>
                                    +{fmt(div.net)}
                                </td>
                                <td className={cn(TD, 'pr-0')}>
                                    {/* Masaüstünde yazılı düğmeler; tablette yer dar olduğu için yalnızca simge */}
                                    <div className="hidden lg:flex items-center justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<Pencil />}
                                            onClick={() => onEdit(div.raw)}
                                            aria-label={`${div.symbol} temettüsünü düzenle`}
                                            className="px-2.5"
                                        >
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<Trash2 />}
                                            onClick={() => onDelete(div)}
                                            aria-label={`${div.symbol} temettüsünü sil`}
                                            className="px-2.5 hover:bg-loss-soft hover:text-loss"
                                        >
                                            Sil
                                        </Button>
                                    </div>
                                    <div className="flex lg:hidden items-center justify-end">
                                        <IconButton
                                            icon={<Pencil />}
                                            label={`${div.symbol} temettüsünü düzenle`}
                                            size="sm"
                                            onClick={() => onEdit(div.raw)}
                                        />
                                        <IconButton
                                            icon={<Trash2 />}
                                            label={`${div.symbol} temettüsünü sil`}
                                            size="sm"
                                            onClick={() => onDelete(div)}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
