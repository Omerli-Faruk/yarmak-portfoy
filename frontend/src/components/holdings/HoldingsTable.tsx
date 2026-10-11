'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    GripVertical,
    Tag,
    Plus,
    MinusCircle,
    Trash2,
    ChevronRight,
    ChevronDown,
} from 'lucide-react';
import type { AssetGroup, AssetSummaryMap, Period, UserHolding } from '@/types';
import { cn } from '@/lib/cn';
import { getPeriodHeaderLabel } from '@/lib/periodUtils';
import { ASSET_TYPE_LABELS } from '@/lib/formatters';
import ChangePill from '@/components/ui/ChangePill';
import Sparkline from '@/components/ui/Sparkline';
import { getHoldingRowMetrics, getHoldingSparkline } from './holdingRowMetrics';
import GroupBadges from './GroupBadges';

interface HoldingsTableProps {
    items: UserHolding[];
    selectedPeriod: Period;
    assetSummaries: AssetSummaryMap;
    groups: AssetGroup[];
    assetGroups: Record<string, string[]>;
    fmt: (amountTRY: number, showPlusSign?: boolean) => string;
    activeGroupMetrics: {
        isCustomGroup: boolean;
        groupName: string;
    };
    onQuickAddTx: (symbol: string) => void;
    onQuickSellTx: (holding: UserHolding) => void;
    onAssignAsset: (asset: UserHolding) => void;
    onDeleteAsset: (asset: UserHolding) => void;
    onRemoveFromCurrentGroup: (symbol: string) => void;
    onDropAsset: (draggedSymbol: string, targetSymbol: string) => void;
}

// Satırdaki düğmeler: zeminsiz, yazılı; dokunma hedefi mobilde 44px, masaüstünde 40px
const ACTION_BASE =
    'inline-flex items-center justify-center gap-1.5 shrink-0 rounded text-sm font-medium cursor-pointer transition-colors duration-[120ms] [&_svg]:size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const ACTION_ICON = cn(ACTION_BASE, 'size-11 sm:size-10');
const ACTION_TEXT = cn(ACTION_BASE, 'h-11 sm:h-10 px-3');

// Masaüstü tablo hücreleri: başlık 36px ve yapışkan, satırlar 48px, sayılar sağa yaslı mono, sütun arası 24px.
// Tablo sabit düzende (table-fixed): sayı sütunları sabit genişlikte, kalan yer varlık sütununa kalır.
// Türe göre görünümde her tür ayrı tablo olduğu için sütunlar ancak böyle alt alta hizalı kalır.
const TH = 'sticky top-0 z-10 h-9 px-3 bg-bg border-b border-border text-xs font-normal text-fg-muted whitespace-nowrap';
const TD = 'h-12 px-3 border-b border-border whitespace-nowrap';
const NUM_TH = cn(TH, 'text-right');
const NUM_TD = cn(TD, 'text-right font-mono text-sm text-fg');
const COL = {
    index: 'w-14',
    amount: 'w-24',
    price: 'w-28',
    value: 'w-36',
    trend: 'w-24',
    pnl: 'w-36',
    actions: 'w-44',
} as const;

// Açılan satırın kapladığı sütun sayısı (xl'deki en geniş hâl; fazlası zararsız)
const COLUMN_COUNT = 9;

// Alt alta tutar ve yüzde: ikisi de sağa yaslı, aynı satır yüksekliğinde ve aynı kalınlıkta
const STACK = 'flex flex-col items-end gap-0.5 leading-tight';

const pnlTextClass = (isPos: boolean) => (isPos ? 'text-profit' : 'text-loss');

// Açılan satırdaki etiket / değer çifti
function DetailItem({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col gap-0.5 min-w-0', className)}>
            <span className="text-xs text-fg-muted">{label}</span>
            <span className="font-mono text-sm text-fg">{children}</span>
        </div>
    );
}

// Mobil ayrıntı alanındaki etiket / değer satırı
function DetailRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fg-muted">{label}</span>
            <span className="font-mono text-fg text-right">{children}</span>
        </div>
    );
}

export default function HoldingsTable({
    items,
    selectedPeriod,
    assetSummaries,
    groups,
    assetGroups,
    fmt,
    activeGroupMetrics,
    onQuickAddTx,
    onQuickSellTx,
    onAssignAsset,
    onDeleteAsset,
    onRemoveFromCurrentGroup,
    onDropAsset,
}: HoldingsTableProps) {
    const [draggedSymbol, setDraggedSymbol] = useState<string | null>(null);
    const [dragOverSymbol, setDragOverSymbol] = useState<string | null>(null);
    // Ayrıntısı açık olan satır (yalnızca görünüm durumu; masaüstü ve mobil aynı anda görünmez)
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

    const periodHeaderLabel = getPeriodHeaderLabel(selectedPeriod);

    const toggleExpanded = (symbol: string) => setExpandedSymbol(prev => (prev === symbol ? null : symbol));

    const resetDrag = () => {
        setDraggedSymbol(null);
        setDragOverSymbol(null);
    };

    const handleDrop = (targetSymbol: string) => {
        if (draggedSymbol && draggedSymbol !== targetSymbol) {
            onDropAsset(draggedSymbol, targetSymbol);
        }
        resetDrag();
    };

    // Masaüstü satırı ve mobil satır aynı sürükle-bırak davranışını kullanır
    const dragHandlers = (symbol: string) => ({
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData('text/plain', symbol);
            e.dataTransfer.effectAllowed = 'move';
            setDraggedSymbol(symbol);
        },
        onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverSymbol !== symbol) setDragOverSymbol(symbol);
        },
        onDragLeave: () => {
            if (dragOverSymbol === symbol) setDragOverSymbol(null);
        },
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            handleDrop(symbol);
        },
        onDragEnd: resetDrag,
    });

    const assignedGroupsOf = (symbol: string) => {
        const ids = assetGroups[symbol] || [];
        return groups.filter(g => ids.includes(g.id));
    };

    // Grup etiketleri ve "Gruba ata / Düzenle" düğmesi
    const renderGroups = (h: UserHolding, assigned: AssetGroup[]) => (
        <div className="flex flex-wrap items-center gap-x-1 min-w-0">
            {assigned.length > 0 && <GroupBadges groups={assigned} />}
            <button
                type="button"
                onClick={() => onAssignAsset(h)}
                className="inline-flex items-center gap-1.5 shrink-0 min-h-11 sm:min-h-10 px-2 rounded text-sm text-primary cursor-pointer transition-colors duration-[120ms] hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={`${h.symbol} gruplarını düzenle`}
            >
                <Tag className="size-4" aria-hidden />
                <span>{assigned.length > 0 ? 'Düzenle' : 'Gruba ata'}</span>
            </button>
        </div>
    );

    // Satırdaki hızlı alış ve satış: yazılı düğmeler
    const renderQuickTrade = (h: UserHolding) => (
        <>
            <button
                type="button"
                onClick={() => onQuickAddTx(h.symbol)}
                className={cn(ACTION_TEXT, 'px-2.5 text-fg-muted hover:bg-surface-3 hover:text-primary')}
                aria-label={`${h.symbol} alış ekle`}
                title="Alış ekle"
            >
                <Plus aria-hidden />
                <span>Al</span>
            </button>
            <button
                type="button"
                onClick={() => onQuickSellTx(h)}
                className={cn(ACTION_TEXT, 'px-2.5 text-loss hover:bg-loss-soft')}
                aria-label={`${h.symbol} sat`}
                title="Satış ekle"
            >
                Sat
            </button>
        </>
    );

    // Açılan satırdaki seyrek işlemler: gruptan çıkarma, silme ve (mobilde) detay sayfası.
    // Masaüstünde sembolün kendisi detay sayfasına gittiği için ikinci bağlantı yalnızca mobilde.
    const renderRowManagement = (h: UserHolding, withDetailLink: boolean) => (
        <>
            {/* Özel grup seçiliyse gruptan çıkarma düğmesi */}
            {activeGroupMetrics.isCustomGroup && (
                <button
                    type="button"
                    onClick={() => onRemoveFromCurrentGroup(h.symbol)}
                    className={cn(ACTION_TEXT, 'text-warning hover:bg-warning-soft')}
                    title={`Bu varlığı "${activeGroupMetrics.groupName}" grubundan çıkar`}
                    aria-label={`Bu varlığı "${activeGroupMetrics.groupName}" grubundan çıkar`}
                >
                    <MinusCircle aria-hidden />
                    <span>Gruptan çıkar</span>
                </button>
            )}

            <button
                type="button"
                onClick={() => onDeleteAsset(h)}
                className={cn(ACTION_TEXT, 'text-fg-muted hover:bg-loss-soft hover:text-loss')}
                title="Varlığı ve tüm işlemlerini portföyden sil"
                aria-label={`${h.symbol} varlığını ve tüm işlemlerini portföyden sil`}
            >
                <Trash2 aria-hidden />
                <span>Sil</span>
            </button>

            {withDetailLink && (
                <Link
                    href={`/assets/${h.symbol}`}
                    className={cn(ACTION_TEXT, 'text-fg hover:bg-surface-3')}
                    aria-label={`${h.symbol} grafik ve detay`}
                >
                    <span>Grafik ve detay</span>
                    <ChevronRight aria-hidden />
                </Link>
            )}
        </>
    );

    const dragHandle = (idx: number) => (
        <span
            className="flex items-center gap-0.5 cursor-grab active:cursor-grabbing text-fg-muted transition-colors duration-[120ms] group-hover/row:text-fg"
            title="Sırasını değiştirmek için tutup sürükleyin"
        >
            <GripVertical className="size-4 shrink-0" aria-hidden />
            <span className="min-w-5 text-right font-mono text-xs">{idx + 1}</span>
        </span>
    );

    const typeLabel = (h: UserHolding) => ASSET_TYPE_LABELS[h.asset_type] ?? h.asset_type;

    return (
        <div className="flex flex-col min-w-0">
            {/* Masaüstü: kutusuz yoğun tablo. Geniş ekranda başlık sayfayla birlikte yapışkan kalır; dar masaüstünde
                taşarsa yatay kayar (o aralıkta kaydırma kabı yüzünden başlık yapışmaz). */}
            <div className="hidden lg:block lg:overflow-x-auto xl:overflow-x-visible custom-horizontal-scrollbar">
                {/* Gerçek 2B veri tablosu: sütun hizası için <table> */}
                <table className="w-full table-fixed text-left border-separate border-spacing-0">
                    <thead>
                        <tr>
                            <th scope="col" className={cn(TH, COL.index, 'pl-2 pr-1')}>
                                <span aria-hidden>#</span>
                                <span className="sr-only">Sıra</span>
                            </th>
                            <th scope="col" className={TH}>Varlık</th>
                            <th scope="col" className={cn(NUM_TH, COL.amount, 'hidden xl:table-cell')}>Adet</th>
                            <th scope="col" className={cn(NUM_TH, COL.price)}>Fiyat</th>
                            <th scope="col" className={cn(NUM_TH, COL.value)}>Değer</th>
                            {/* Seyir "olsa iyi olur" sütunu: dar masaüstünde gizli, varlık adına yer kalsın */}
                            <th scope="col" className={cn(NUM_TH, COL.trend, 'hidden xl:table-cell')} title="1 yıl, 6 ay, 3 ay, 1 ay, 1 hafta ve 1 gün önceki fiyatlardan">
                                Seyir (1Y)
                            </th>
                            {/* Uzun dönem adı ("Yılbaşından bugüne K/Z") iki satıra iner */}
                            <th scope="col" className={cn(NUM_TH, COL.pnl)}>
                                <span className="inline-block whitespace-normal leading-tight">{periodHeaderLabel}</span>
                            </th>
                            <th scope="col" className={cn(NUM_TH, COL.pnl)}>Toplam K/Z</th>
                            <th scope="col" className={cn(NUM_TH, COL.actions, 'pr-2')}>
                                <span className="sr-only">İşlemler</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {items.map((h, idx) => {
                            const { pnl, pnlPct, isPos, periodRetVal, periodPnl, isPeriodPos } =
                                getHoldingRowMetrics(h, selectedPeriod, assetSummaries);
                            const isDragging = draggedSymbol === h.symbol;
                            const isOver = dragOverSymbol === h.symbol;
                            const isExpanded = expandedSymbol === h.symbol;
                            const spark = getHoldingSparkline(h, assetSummaries);
                            const detailId = `holding-row-detail-${h.symbol}`;

                            return (
                                <React.Fragment key={h.symbol}>
                                    <tr
                                        {...dragHandlers(h.symbol)}
                                        className={cn(
                                            'group/row select-none transition-colors duration-[120ms] hover:bg-surface-2',
                                            isExpanded && 'bg-surface-2 [&>td]:border-b-0',
                                            isDragging && 'opacity-40',
                                            // Bırakılacak yer: satırın üstünde 2px mavi çizgi
                                            isOver && 'bg-primary-soft hover:bg-primary-soft [&>td]:relative [&>td]:before:absolute [&>td]:before:inset-x-0 [&>td]:before:top-0 [&>td]:before:h-0.5 [&>td]:before:bg-primary',
                                        )}
                                    >
                                        <td className={cn(TD, 'pl-2 pr-1')}>{dragHandle(idx)}</td>

                                        {/* Sembol; altında ad */}
                                        <td className={TD}>
                                            <div className="flex flex-col min-w-0 leading-tight">
                                                <Link
                                                    href={`/assets/${h.symbol}`}
                                                    className="w-fit rounded font-mono text-sm font-semibold text-fg underline-offset-2 transition-colors duration-[120ms] hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                                    title={`${h.symbol} grafik ve detay`}
                                                >
                                                    {h.symbol}
                                                </Link>
                                                <span className="text-xs text-fg-muted truncate">{h.asset_name}</span>
                                            </div>
                                        </td>

                                        <td className={cn(NUM_TD, 'hidden xl:table-cell')}>{h.total_amount.toLocaleString('tr-TR')}</td>

                                        <td className={NUM_TD}>{fmt(h.current_price)}</td>

                                        <td className={cn(NUM_TD, 'font-medium')}>{fmt(h.total_value)}</td>

                                        <td className={cn(TD, 'hidden xl:table-cell text-right')}>
                                            {spark.length > 0 ? (
                                                <Sparkline values={spark} width={64} height={20} className="ml-auto" />
                                            ) : (
                                                <span className="font-mono text-fg-muted">—</span>
                                            )}
                                        </td>

                                        {/* Seçili dönemin K/Z'si */}
                                        <td className={NUM_TD}>
                                            {periodPnl !== null && periodRetVal !== null ? (
                                                <div className={STACK}>
                                                    <span className={cn('font-medium', pnlTextClass(isPeriodPos))}>{fmt(periodPnl, true)}</span>
                                                    <ChangePill value={periodRetVal} className="leading-tight" />
                                                </div>
                                            ) : (
                                                <span className="text-fg-muted">—</span>
                                            )}
                                        </td>

                                        {/* Pozisyonun toplam K/Z'si */}
                                        <td className={NUM_TD}>
                                            <div className={STACK}>
                                                <span className={cn('font-medium', pnlTextClass(isPos))}>{fmt(pnl, true)}</span>
                                                <ChangePill value={pnlPct} className="leading-tight" />
                                            </div>
                                        </td>

                                        {/* Hızlı alış/satış ve ayrıntı aç/kapa */}
                                        <td className={cn(TD, 'pr-2')}>
                                            <div className="flex items-center justify-end gap-0.5">
                                                {renderQuickTrade(h)}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpanded(h.symbol)}
                                                    aria-expanded={isExpanded}
                                                    aria-controls={detailId}
                                                    className={cn(ACTION_ICON, 'text-fg-muted hover:bg-surface-3 hover:text-fg')}
                                                    title="Ayrıntılar"
                                                    aria-label={`${h.symbol} ayrıntıları`}
                                                >
                                                    <ChevronDown className={cn(isExpanded && 'rotate-180')} aria-hidden />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Açılan satır: seyrek gereken rakamlar, gruplar ve yönetim işlemleri */}
                                    {isExpanded && (
                                        <tr id={detailId} className="bg-surface-2">
                                            <td colSpan={COLUMN_COUNT} className="pl-17 pr-2 pt-1 pb-2 border-b border-border">
                                                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                                                    <div className="flex flex-wrap items-start gap-x-8 gap-y-2 min-w-0">
                                                        <DetailItem label="Tür"><span className="font-sans">{typeLabel(h)}</span></DetailItem>
                                                        <DetailItem label="Adet" className="xl:hidden">{h.total_amount.toLocaleString('tr-TR')}</DetailItem>
                                                        <DetailItem label="Ortalama maliyet">{fmt(h.average_cost)}</DetailItem>
                                                        <DetailItem label="Toplam maliyet">{fmt(h.average_cost * h.total_amount)}</DetailItem>
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <span className="text-xs text-fg-muted">Gruplar</span>
                                                            {renderGroups(h, assignedGroupsOf(h.symbol))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-0.5">{renderRowManagement(h, false)}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobil ve tablet: iki satırlı yığın satırlar; dokununca ayrıntı ve işlemler açılır */}
            <div className="flex flex-col divide-y divide-border border-b border-border lg:hidden">
                {items.map((h, idx) => {
                    const { pnl, pnlPct, periodRetVal, periodPnl } =
                        getHoldingRowMetrics(h, selectedPeriod, assetSummaries);
                    const isDragging = draggedSymbol === h.symbol;
                    const isOver = dragOverSymbol === h.symbol;
                    const isExpanded = expandedSymbol === h.symbol;
                    const spark = getHoldingSparkline(h, assetSummaries);
                    const detailId = `holding-detail-${h.symbol}`;

                    return (
                        <div
                            key={h.symbol}
                            {...dragHandlers(h.symbol)}
                            className={cn(
                                'group/row relative flex flex-col select-none',
                                isExpanded && 'bg-surface-2',
                                isDragging && 'opacity-40',
                                isOver && 'bg-primary-soft before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary',
                            )}
                        >
                            {/* Üst satır: sembol + değer; alt satır: ad + toplam K/Z */}
                            <div className="flex items-center gap-2 pr-1 transition-colors duration-[120ms] hover:bg-surface-2">
                                {dragHandle(idx)}
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(h.symbol)}
                                    aria-expanded={isExpanded}
                                    aria-controls={detailId}
                                    className="flex flex-1 items-center gap-3 min-w-0 min-h-14 py-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                >
                                    <span className="flex flex-1 flex-col min-w-0 gap-1">
                                        <span className="font-mono text-sm font-semibold leading-5 text-fg">{h.symbol}</span>
                                        <span className="text-xs leading-5 text-fg-muted truncate">{h.asset_name}</span>
                                    </span>
                                    {spark.length > 0 && (
                                        <Sparkline values={spark} width={48} height={18} className="hidden sm:block" />
                                    )}
                                    {/* Değer üstte, toplam K/Z yüzdesi altta; sabit en az genişlik, satırlar alt alta hizalı */}
                                    <span className="flex flex-col items-end gap-1 min-w-32 shrink-0">
                                        <span className="font-mono text-sm font-medium leading-5 text-fg">{fmt(h.total_value)}</span>
                                        <ChangePill value={pnlPct} title="Toplam K/Z" className="leading-5" />
                                    </span>
                                    <ChevronDown
                                        className={cn('size-5 shrink-0 text-fg-muted', isExpanded && 'rotate-180')}
                                        aria-hidden
                                    />
                                </button>
                            </div>

                            {isExpanded && (
                                <div id={detailId} className="flex flex-col gap-3 pl-10 pr-1 pb-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:[&>*]:basis-[calc(50%-1rem)] sm:[&>*]:grow">
                                        <DetailRow label="Tür">
                                            <span className="font-sans">{typeLabel(h)}</span>
                                        </DetailRow>
                                        <DetailRow label="Adet">{h.total_amount.toLocaleString('tr-TR')}</DetailRow>
                                        <DetailRow label="Ortalama maliyet">{fmt(h.average_cost)}</DetailRow>
                                        <DetailRow label="Fiyat">{fmt(h.current_price)}</DetailRow>
                                        <DetailRow label={periodHeaderLabel}>
                                            {periodPnl !== null && periodRetVal !== null ? (
                                                <ChangePill value={periodRetVal} amount={fmt(periodPnl, true)} />
                                            ) : (
                                                <span className="text-fg-muted">—</span>
                                            )}
                                        </DetailRow>
                                        <DetailRow label="Toplam K/Z">
                                            <ChangePill value={pnlPct} amount={fmt(pnl, true)} />
                                        </DetailRow>
                                    </div>

                                    {/* Grup etiketleri ve işlemler */}
                                    {renderGroups(h, assignedGroupsOf(h.symbol))}
                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                        {renderQuickTrade(h)}
                                        {renderRowManagement(h, true)}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
