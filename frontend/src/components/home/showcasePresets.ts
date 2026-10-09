import type { ElementType } from 'react';
import { Target, LineChart, ShieldCheck } from 'lucide-react';

// Ana sayfadaki örnek portföylerin verileri. Rakamlar temsilidir, gerçek fiyat veya getiri değildir.

export type Period = '1A' | '3A' | '6A' | '1Y' | 'TÜMÜ';

export const SHOWCASE_PERIODS: Period[] = ['1A', '3A', '6A', '1Y', 'TÜMÜ'];

export interface HoldingItem {
    symbol: string;
    name: string;
    type: 'HISSE' | 'FON' | 'ALTIN' | 'DOVIZ';
    weight: number;
    price: string;
    change: string;
    positive: boolean;
}

export interface AllocationItem {
    label: string;
    percent: number;
    color: string;
}

export interface Preset {
    id: string;
    title: string;
    shortTitle: string;
    icon: ElementType;
    badge: string;
    totalValue: string;
    totalReturnPercent: string;
    dailyChange: string;
    dailyPercent: string;
    isDailyPositive: boolean;
    allocations: AllocationItem[];
    holdings: HoldingItem[];
    // Grafik noktaları bin TL cinsindendir
    chartData: Record<Period, number[]>;
}

// Birden fazla örnekte geçen satırlar; ağırlık her örnekte ayrıca verilir.
// TI2'nin adı TEFAS'taki kaydıyla aynıdır (hisse senedi yoğun fon).
const TI2: Omit<HoldingItem, 'weight'> = {
    symbol: 'TI2',
    name: 'İş Portföy Hisse Senedi (TL) Fonu (Hisse Senedi Yoğun Fon)',
    type: 'FON',
    price: '0,1221 ₺',
    change: '+1,15%',
    positive: true,
};

const USDTRY: Omit<HoldingItem, 'weight'> = {
    symbol: 'USDTRY',
    name: 'Amerikan Doları',
    type: 'DOVIZ',
    price: '48,83 ₺',
    change: '+0,06%',
    positive: true,
};

const ALTIN: Omit<HoldingItem, 'weight'> = {
    symbol: 'ALTIN',
    name: 'Gram Altın',
    type: 'ALTIN',
    price: '6.787,00 ₺',
    change: '+0,80%',
    positive: true,
};

export const PRESETS: Preset[] = [
    {
        id: 'balanced',
        title: 'Dengeli Karma Portföy',
        shortTitle: 'Dengeli Karma',
        icon: Target,
        badge: 'BIST + TEFAS + Altın',
        totalValue: '548.250,00',
        totalReturnPercent: '+35,04%',
        dailyChange: '+4.280,00',
        dailyPercent: '+0,78%',
        isDailyPositive: true,
        allocations: [
            { label: 'Hisse Senedi', percent: 40, color: 'bg-[#1A9FD3]' },
            { label: 'TEFAS Fonu', percent: 30, color: 'bg-slate-400' },
            { label: 'Altın', percent: 20, color: 'bg-amber-400' },
            { label: 'Döviz', percent: 10, color: 'bg-emerald-400' },
        ],
        holdings: [
            { symbol: 'THYAO', name: 'Türk Hava Yolları', type: 'HISSE', weight: 20, price: '318,50 ₺', change: '+2,40%', positive: true },
            { ...TI2, weight: 30 },
            { ...ALTIN, weight: 20 },
            { symbol: 'ASELS', name: 'Aselsan Elektronik', type: 'HISSE', weight: 20, price: '64,20 ₺', change: '+3,10%', positive: true },
            { ...USDTRY, weight: 10 },
        ],
        chartData: {
            '1A': [512, 515, 518, 514, 520, 526, 522, 529, 535, 532, 541, 548],
            '3A': [470, 478, 472, 485, 492, 490, 505, 512, 520, 525, 538, 548],
            '6A': [410, 422, 435, 430, 448, 460, 475, 482, 500, 515, 532, 548],
            '1Y': [340, 360, 375, 390, 410, 430, 450, 465, 490, 510, 530, 548],
            'TÜMÜ': [220, 250, 280, 310, 345, 380, 420, 455, 490, 515, 535, 548],
        },
    },
    {
        id: 'growth',
        title: 'BIST Büyüme',
        shortTitle: 'BIST Büyüme',
        icon: LineChart,
        badge: 'Hisse Ağırlıklı',
        totalValue: '426.800,00',
        totalReturnPercent: '+55,65%',
        dailyChange: '+7.940,00',
        dailyPercent: '+1,89%',
        isDailyPositive: true,
        allocations: [
            { label: 'BIST 100 Hisse', percent: 75, color: 'bg-[#1A9FD3]' },
            { label: 'Hisse Senedi Fonu', percent: 15, color: 'bg-slate-400' },
            { label: 'Döviz', percent: 10, color: 'bg-emerald-400' },
        ],
        holdings: [
            { symbol: 'ASELS', name: 'Aselsan Elektronik', type: 'HISSE', weight: 30, price: '64,20 ₺', change: '+3,10%', positive: true },
            { symbol: 'THYAO', name: 'Türk Hava Yolları', type: 'HISSE', weight: 25, price: '318,50 ₺', change: '+2,40%', positive: true },
            { symbol: 'TUPRS', name: 'Tüpraş Rafineri', type: 'HISSE', weight: 20, price: '168,70 ₺', change: '+1,85%', positive: true },
            { ...TI2, weight: 15 },
            { ...USDTRY, weight: 10 },
        ],
        chartData: {
            '1A': [380, 385, 378, 395, 402, 398, 410, 405, 415, 412, 420, 426],
            '3A': [340, 355, 345, 368, 380, 372, 390, 385, 402, 410, 418, 426],
            '6A': [290, 310, 305, 330, 345, 340, 365, 380, 395, 405, 415, 426],
            '1Y': [230, 255, 270, 290, 315, 335, 360, 380, 395, 410, 420, 426],
            'TÜMÜ': [140, 175, 210, 245, 280, 310, 345, 375, 395, 410, 420, 426],
        },
    },
    {
        id: 'defensive',
        title: 'Defansif Portföy',
        shortTitle: 'Defansif & Altın',
        icon: ShieldCheck,
        badge: 'Altın Ağırlıklı',
        totalValue: '684.500,00',
        totalReturnPercent: '+31,56%',
        dailyChange: '+2.150,00',
        dailyPercent: '+0,31%',
        isDailyPositive: true,
        allocations: [
            { label: 'Altın', percent: 60, color: 'bg-amber-400' },
            { label: 'Döviz (USD)', percent: 40, color: 'bg-emerald-400' },
        ],
        holdings: [
            { ...ALTIN, weight: 60 },
            { ...USDTRY, weight: 40 },
        ],
        chartData: {
            '1A': [668, 670, 671, 673, 674, 676, 678, 680, 681, 682, 683, 684],
            '3A': [640, 645, 649, 653, 658, 662, 667, 671, 675, 679, 682, 684],
            '6A': [590, 600, 610, 622, 632, 642, 652, 660, 669, 676, 681, 684],
            '1Y': [510, 528, 545, 562, 580, 598, 615, 632, 650, 665, 678, 684],
            'TÜMÜ': [320, 360, 400, 440, 485, 530, 575, 615, 650, 670, 680, 684],
        },
    },
];
