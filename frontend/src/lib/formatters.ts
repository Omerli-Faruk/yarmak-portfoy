// Para birimine göre formatlama yardımcısı — Dashboard ve Holdings sayfalarında ortak kullanılır
export function formatCurrency(amountTRY: number, currency: 'TRY' | 'USD', usdRate: number, showPlusSign: boolean = false): string {
    if (isNaN(amountTRY)) amountTRY = 0;
    const isNeg = amountTRY < -0.000001;
    const isPos = amountTRY > 0.000001;
    const prefix = showPlusSign && isPos ? '+' : (isNeg ? '-' : '');
    const absVal = Math.abs(amountTRY);

    if (currency === 'USD') {
        const valUSD = absVal / (usdRate > 0 ? usdRate : 1);
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(valUSD);
        return `${prefix}$${formatted}`;
    }

    const formattedTRY = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(absVal);
    return `${prefix}${formattedTRY} ₺`;
}

// TL cinsinden formatlama (dolar dönüştürme olmadan)
export function formatMoney(amount: number): string {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
}

// Tarih formatlama (Türkçe, gün ay yıl saat:dakika)
export function formatDate(dateStr?: string | Date | null): string {
    if (!dateStr) return '—';
    try {
        const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    } catch {
        return '—';
    }
}
