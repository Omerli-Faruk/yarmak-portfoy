'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PRESETS, SHOWCASE_PERIODS, type Period } from './showcasePresets';
import ShowcaseChart from './ShowcaseChart';
import Section from '@/components/ui/Section';
import Hero, { HeroMeta } from '@/components/ui/Hero';
import ChangePill from '@/components/ui/ChangePill';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { buttonClasses } from '@/components/ui/Button';

const PERIOD_OPTIONS = SHOWCASE_PERIODS.map((period) => ({ value: period, label: period }));

const PRESET_OPTIONS = PRESETS.map((p) => ({ value: p.id, title: p.title, label: p.shortTitle }));

// Varlık listesinin sütun genişlikleri; başlık ve satırlar aynı değerleri kullanır.
// Sıra panodaki varlık listesiyle aynı: önce fiyat, sonra yüzdeler (ağırlık, günlük değişim).
const COL_WEIGHT = 'hidden w-12 shrink-0 text-right sm:block';
const COL_PRICE = 'w-24 shrink-0 text-right';
const COL_CHANGE = 'w-20 shrink-0 text-right';

// Ana sayfadaki örnek portföy. Veriler sabit ve temsilidir.
// Solda büyük toplam değer ve grafik, sağdaki dar sütunda dağılım, varlık listesi ve kayıt bağlantısı.
// Ana sayfa giriş yapmış kullanıcıyı panele yönlendirdiği için burada yalnızca kayıt bağlantısı var.
// Örnek verilerdeki değişimler hazır metin olduğu için ChangePill'e yalnızca yön (+1 / -1) verilir, metin children'dan gelir.
export default function PortfolioShowcase() {
    const [activePresetId, setActivePresetId] = useState<string>('balanced');
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3A');

    const activePreset = useMemo(() => {
        return PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    }, [activePresetId]);

    const points = useMemo(() => {
        return activePreset.chartData[selectedPeriod] || activePreset.chartData['3A'];
    }, [activePreset, selectedPeriod]);

    // Grafiğin ilk ve son noktası arasındaki değişim (panel grafiğindeki dönem getirisi gibi)
    const periodReturn = useMemo(() => {
        if (points.length < 2 || points[0] <= 0) return 0;
        return ((points[points.length - 1] - points[0]) / points[0]) * 100;
    }, [points]);

    return (
        <Section
            title="Örnek portföy"
            description={<span className="text-warning">Temsili veriler</span>}
            action={
                <SegmentedControl
                    options={PRESET_OPTIONS}
                    value={activePresetId}
                    onChange={setActivePresetId}
                    size="sm"
                    ariaLabel="Örnek portföy seçimi"
                />
            }
            contentClassName="pt-2"
        >
            <div className="flex flex-col gap-10 lg:flex-row">
                {/* Ana sütun: toplam değer ve grafik */}
                <Hero
                    size="md"
                    className="lg:basis-0 lg:grow"
                    label="Toplam değer"
                    value={`${activePreset.totalValue} ₺`}
                    sub={
                        <>
                            <HeroMeta label="Toplam getiri">
                                <ChangePill value={1} size="md">{activePreset.totalReturnPercent}</ChangePill>
                            </HeroMeta>
                            <HeroMeta label="Bugün">
                                <ChangePill value={activePreset.isDailyPositive ? 1 : -1} size="md">
                                    {activePreset.dailyChange} ₺ ({activePreset.dailyPercent})
                                </ChangePill>
                            </HeroMeta>
                        </>
                    }
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                            <span className="flex items-baseline gap-2">
                                <span className="text-sm text-fg-muted">{selectedPeriod} getirisi</span>
                                <ChangePill value={periodReturn} size="md" />
                            </span>
                            <SegmentedControl
                                options={PERIOD_OPTIONS}
                                value={selectedPeriod}
                                onChange={setSelectedPeriod}
                                size="sm"
                                mono
                                ariaLabel="Grafik dönemi"
                            />
                        </div>
                        <ShowcaseChart points={points} />
                    </div>
                </Hero>

                {/* Yan sütun: dağılım, varlıklar ve kayıt bağlantısı */}
                <div className="flex w-full min-w-0 flex-col gap-8 lg:w-[360px] lg:shrink-0">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-base font-semibold text-fg">Dağılım</h3>

                        <div className="flex h-2 w-full gap-px overflow-hidden rounded-sm">
                            {activePreset.allocations.map((alloc) => (
                                <div
                                    key={alloc.label}
                                    style={{ flexGrow: alloc.percent, flexBasis: 0 }}
                                    className={alloc.color}
                                    title={`${alloc.label}: %${alloc.percent}`}
                                />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                            {activePreset.allocations.map((alloc) => (
                                <div key={alloc.label} className="flex items-center gap-2">
                                    <span className={`size-2.5 rounded-[2px] ${alloc.color}`} aria-hidden />
                                    <span className="text-fg-muted">{alloc.label}</span>
                                    <span className="font-mono text-fg">%{alloc.percent}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <h3 className="pb-2 text-base font-semibold text-fg">Varlıklar</h3>

                        <div className="flex h-9 items-center gap-3 border-y border-border text-xs text-fg-muted">
                            <span className="min-w-0 flex-1">Varlık</span>
                            <span className={COL_PRICE}>Fiyat</span>
                            <span className={COL_WEIGHT}>Ağırlık</span>
                            <span className={COL_CHANGE}>Gün</span>
                        </div>

                        <ul className="flex flex-col divide-y divide-border border-b border-border">
                            {activePreset.holdings.map((h) => (
                                <li key={h.symbol} className="flex min-h-12 items-center gap-3 py-1.5">
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="flex items-baseline gap-1.5">
                                            <span className="font-mono text-sm font-medium text-fg">{h.symbol}</span>
                                            {/* Mobilde ağırlık sütunu gizli, sembolün yanında gösterilir */}
                                            <span className="font-mono text-xs text-fg-muted sm:hidden">%{h.weight}</span>
                                        </span>
                                        <span className="truncate text-xs text-fg-muted" title={h.name}>
                                            {h.name}
                                        </span>
                                    </div>
                                    <span className={`${COL_PRICE} font-mono text-sm text-fg`}>{h.price}</span>
                                    <span className={`${COL_WEIGHT} font-mono text-sm text-fg`}>%{h.weight}</span>
                                    <span className={COL_CHANGE}>
                                        <ChangePill value={h.positive ? 1 : -1}>{h.change}</ChangePill>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Link href="/register" className={buttonClasses({ fullWidth: true })}>
                            <span>Kendi portföyünü oluştur</span>
                            <ArrowRight aria-hidden />
                        </Link>
                        <span className="text-center text-sm text-fg-muted">Ücretsiz</span>
                    </div>
                </div>
            </div>
        </Section>
    );
}
