'use client';

import type { Currency } from '@/hooks/useCurrency';

interface CurrencyToggleProps {
    currency: Currency;
    onToggle: () => void;
    disabled?: boolean; // kur bilgisi yoksa true verin
    className?: string;
}

// TRY / USD geçiş düğmesi (Portföyüm ve Varlıklarım üst bölümü)
export default function CurrencyToggle({ currency, onToggle, disabled = false, className = '' }: CurrencyToggleProps) {
    // Kur yokken tutarlar TL gösterildiği için düğme de TL göstersin
    const shown: Currency = disabled ? 'TRY' : currency;

    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            title={disabled ? 'Kur bilgisi alınamadı' : 'Tüm değerleri dolar veya TL cinsinden görüntüle'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm border bg-slate-800 border-slate-700 text-slate-100 ${
                disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-[#1A9FD3] hover:text-[#1A9FD3] active:scale-95 cursor-pointer'
            } ${className}`}
        >
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-200">
                {shown}
            </span>
            <span>Para Birimi:</span>
            <span className="px-2 py-0.5 rounded-md font-extrabold bg-[#1A9FD3]/15 text-[#1A9FD3]">
                {shown === 'TRY' ? '₺ TRY' : '$ USD'}
            </span>
        </button>
    );
}
