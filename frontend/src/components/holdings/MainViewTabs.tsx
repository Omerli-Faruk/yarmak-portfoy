'use client';

import React from 'react';
import SegmentedControl from '@/components/ui/SegmentedControl';

export type MainViewTab = 'positions' | 'transactions' | 'dividends';

// Varlık sayısı grup sekmesinde ("Tüm varlıklar") yazdığı için burada tekrar edilmez
const TABS: { value: MainViewTab; label: string }[] = [
    { value: 'positions', label: 'Pozisyonlar' },
    { value: 'transactions', label: 'İşlem geçmişi' },
    { value: 'dividends', label: 'Temettüler' },
];

interface MainViewTabsProps {
    tab: MainViewTab;
    onChange: (tab: MainViewTab) => void;
}

// Pozisyonlar / İşlem geçmişi / Temettüler sayfa sekmeleri (alt çizgili). Sığmazsa yatay kayar.
export default function MainViewTabs({ tab, onChange }: MainViewTabsProps) {
    // Alt çizgi sayfa genişliğinde uzansın diye sarmalayıcı denetimin genişliğini doldurur
    return (
        <div className="[&>[role=group]]:w-full">
            <SegmentedControl variant="underline" options={TABS} value={tab} onChange={onChange} ariaLabel="Görünüm" />
        </div>
    );
}
