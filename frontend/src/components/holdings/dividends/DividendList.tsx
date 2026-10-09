'use client';

import React from 'react';
import { Dividend, NormalizedDividend } from '@/types';
import { formatDateOnly } from '@/lib/formatters';
import { Pencil, Trash2 } from 'lucide-react';

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
    return gross > 0 ? `${Math.round((tax / gross) * 100)}%` : '—';
}

export default function DividendList({ rows, fmt, onEdit, onDelete }: DividendListProps) {
    return (
        <>
            {/* Masaüstü tablo */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Ödeme Tarihi</th>
                            <th className="py-3 px-4">Varlık / Şirket</th>
                            <th className="py-3 px-4 text-right">Brüt Tutar</th>
                            <th className="py-3 px-4 text-right">Stopaj Kesintisi</th>
                            <th className="py-3 px-4 text-right">Hesaba Yatan Net</th>
                            <th className="py-3 px-4 text-center">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                        {rows.map((div, idx) => (
                            <tr key={div.id || idx} className="hover:bg-slate-800/30 transition">
                                <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                                    {formatDateOnly(div.date)}
                                </td>
                                <td className="py-3.5 px-4">
                                    <div className="font-bold text-white flex items-center gap-2">
                                        <span>{div.symbol || '—'}</span>
                                        {div.assetName && (
                                            <span className="text-[11px] font-normal text-slate-400 truncate max-w-[180px]">
                                                {div.assetName}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                                    {fmt(div.gross)}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="text-amber-400 font-mono tabular-nums">
                                            -{fmt(div.tax)}
                                        </span>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            {taxRateLabel(div.gross, div.tax)}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                                    +{fmt(div.net)}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => onEdit(div.raw)}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                            title="Temettüyü Düzenle"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(div)}
                                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                            title="Kaydı Sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobil kartlar */}
            <div className="md:hidden space-y-3">
                {rows.map((div, idx) => (
                    <div
                        key={div.id || idx}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">{div.symbol || '—'}</span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {formatDateOnly(div.date)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onEdit(div.raw)}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                    title="Düzenle"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(div)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                    title="Sil"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {div.assetName && (
                            <p className="text-xs text-slate-400 truncate">{div.assetName}</p>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase block font-medium">Brüt</span>
                                <span className="font-mono text-slate-300 font-semibold">{fmt(div.gross)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase block font-medium">
                                    Stopaj ({taxRateLabel(div.gross, div.tax)})
                                </span>
                                <span className="font-mono text-amber-400 font-semibold">-{fmt(div.tax)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-emerald-500 uppercase block font-medium">Net Yatan</span>
                                <span className="font-mono text-emerald-400 font-bold">+{fmt(div.net)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
