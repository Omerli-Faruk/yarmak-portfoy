'use client';

import type { ReactNode } from 'react';
import Section from '@/components/ui/Section';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { AssetFundamentals } from './types';

// Etiket/değer satırı: etiket solda, değer sağda mono; hint değerin altında küçük yazı
function Row({ label, value, hint }: { label: ReactNode; value?: ReactNode; hint?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 min-h-11 py-1.5">
            <dt className="flex items-center gap-2 min-w-0 text-sm text-fg-muted">{label}</dt>
            <dd className="flex flex-col items-end min-w-0 text-right">
                <span className="font-mono text-sm text-fg truncate max-w-full">{value}</span>
                {hint && <span className="font-mono text-xs text-fg-muted">{hint}</span>}
            </dd>
        </div>
    );
}

const has = (v?: string | null): v is string => !!v && v !== '-';

// Hisseler için Yahoo'dan gelen temel veriler ve temettü bilgileri. Değerler API'den biçimlenmiş metin olarak gelir.
export default function FundamentalsGrid({ fundamentals, className }: { fundamentals: AssetFundamentals; className?: string }) {
    return (
        <div className={cn('flex flex-col gap-10', className)}>
            <Section title="Temel veriler" size="sm">
                <dl className="flex flex-col border-y border-border divide-y divide-border">
                    <Row label="Piyasa değeri" value={fundamentals.marketCap} />
                    <Row label="F/K oranı" value={fundamentals.peRatio} />
                    <Row label="Beta (risk)" value={fundamentals.beta} />
                    <Row label="52 hafta zirve" value={fundamentals.fiftyTwoWeekHigh} />
                    <Row label="52 hafta dip" value={fundamentals.fiftyTwoWeekLow} />
                    <Row label="Hacim" value={fundamentals.volume} />
                </dl>
            </Section>

            <DividendSection fundamentals={fundamentals} />
        </div>
    );
}

// Temettü: açıklanan (gelecek) temettü, son dağıtılan, son 12 ay toplamı, verim ve son ödemeler.
// Tutarlar hisse başı brüt; tarihler hak kullanım (temettüsüz işlem görmeye başladığı) tarihi.
function DividendSection({ fundamentals }: { fundamentals: AssetFundamentals }) {
    const info = fundamentals.dividends;
    const yieldText = has(fundamentals.dividendYield) ? fundamentals.dividendYield : info?.trailingYield;
    // Geçmiş alınamadıysa Yahoo'nun tek temettü tarihi gösterilir (eski davranış)
    const legacyExDate = !info && has(fundamentals.exDividendDate) ? fundamentals.exDividendDate : null;
    const legacyIsFuture = fundamentals.isExDateFuture === 'true';

    const hasAnything = !!info || !!yieldText || !!legacyExDate;

    return (
        <Section title="Temettü" size="sm" contentClassName="gap-3">
            {!hasAnything ? (
                <p className="py-3 text-sm text-fg-muted border-y border-border">
                    Son 10 yılda temettü dağıtımı bulunamadı.
                </p>
            ) : (
                <>
                    <dl className="flex flex-col border-y border-border divide-y divide-border">
                        {info?.next && (
                            <Row
                                label={
                                    <>
                                        <span className="truncate">Gelecek temettü</span>
                                        {/* Bu alandaki tek durum rozeti */}
                                        <Badge tone="warning">Açıklandı</Badge>
                                    </>
                                }
                                value={info.next.exDate}
                                hint={info.next.payDate ? `Ödeme ${info.next.payDate}` : undefined}
                            />
                        )}
                        {info?.last && (
                            <Row label="Son temettü" value={info.last.amount} hint={info.last.exDate} />
                        )}
                        {info && !info.next && (
                            <Row label="Gelecek temettü" value={<span className="text-fg-muted">Açıklanmadı</span>} />
                        )}
                        {info?.trailing12m && (
                            <Row
                                label="Son 12 ay toplamı"
                                value={info.trailing12m.amount}
                                hint={`${info.trailing12m.count} ödeme`}
                            />
                        )}
                        {yieldText && <Row label="Temettü verimi" value={yieldText} />}
                        {has(fundamentals.dividendRate) && (
                            <Row label="Yıllık temettü (beklenen)" value={fundamentals.dividendRate} />
                        )}
                        {legacyExDate && (
                            <Row
                                label={
                                    <>
                                        <span className="truncate">{legacyIsFuture ? 'Açıklanan temettü' : 'Son temettü tarihi'}</span>
                                        {legacyIsFuture && <Badge tone="warning">Planlanan</Badge>}
                                    </>
                                }
                                value={legacyExDate}
                            />
                        )}
                    </dl>

                    {info && info.history.length > 1 && (
                        <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-semibold text-fg">Son ödemeler</h3>
                            <ul className="flex flex-col divide-y divide-border">
                                {info.history.map(d => (
                                    <li key={d.exDate} className="flex items-center justify-between gap-3 h-10 text-sm">
                                        <span className="font-mono text-fg-muted">{d.exDate}</span>
                                        <span className="font-mono text-fg">{d.amount}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-xs text-fg-muted leading-relaxed">
                        Tutarlar hisse başı brüt temettüdür; tarihler hak kullanım tarihidir.
                    </p>
                </>
            )}
        </Section>
    );
}
