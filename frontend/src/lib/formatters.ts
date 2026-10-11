// Uygulama genelinde para ve yüzde gösterimi. TL tutarları "1.234,56 ₺" biçiminde yazılır
// (sayı, normal boşluk, ₺). Eksi işareti her yerde gerçek eksi (−); yüzdelerle aynı genişlikte durur.

function formatTrNumber(value: number, decimals: number): string {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

function signPrefix(amount: number, showPlusSign: boolean): string {
    if (amount < -0.000001) return '−';
    return showPlusSign && amount > 0.000001 ? '+' : '';
}

// TL tutarı seçili para biriminde yazar. Kur yoksa (usdRate > 0 değilse) USD seçili olsa bile TL gösterilir.
export function formatCurrency(
    amountTRY: number,
    currency: 'TRY' | 'USD',
    usdRate: number | null | undefined,
    showPlusSign: boolean = false
): string {
    if (isNaN(amountTRY)) amountTRY = 0;
    const prefix = signPrefix(amountTRY, showPlusSign);
    const absVal = Math.abs(amountTRY);

    if (currency === 'USD' && usdRate && usdRate > 0) {
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(absVal / usdRate);
        return `${prefix}$${formatted}`;
    }

    return `${prefix}${formatTrNumber(absVal, 2)} ₺`;
}

// Kur çevirmeden TL yazar: formatTRY(1234.5) -> "1.234,50 ₺"
export function formatTRY(amount: number, decimals: number = 2, showPlusSign: boolean = false): string {
    if (isNaN(amount)) amount = 0;
    return `${signPrefix(amount, showPlusSign)}${formatTrNumber(Math.abs(amount), decimals)} ₺`;
}

// Birim fiyatın ondalık hane sayısı: 0,01 altı 6, 1 altı 4, diğerleri 2 hane.
// Fiyat farkı da aynı varlığın fiyatıyla aynı hanede yazılsın diye ayrıca dışa açık.
export function priceDecimals(price: number): number {
    return price < 1 ? (price < 0.01 ? 6 : 4) : 2;
}

// Birim fiyat: 1 TL altındaki fiyatlarda daha fazla ondalık gösterilir.
export function formatPriceTR(price: number): string {
    if (isNaN(price)) price = 0;
    return `${formatTrNumber(price, priceDecimals(price))} ₺`;
}

// Yüzde biçimi (Türkçe yazım, % sayının önünde): "+%2,40", "−%1,05", sıfırda "%0,00".
// Eksi için kısa çizgi değil gerçek eksi işareti (−) kullanılır.
export function formatSignedPercent(value: number, decimals: number = 2): string {
    const rounded = isFinite(value) ? Number(value.toFixed(decimals)) : 0;
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
    return `${sign}%${formatTrNumber(Math.abs(rounded), decimals)}`;
}

// İşaretsiz yüzde (pay, oran): formatPercent(12.5, 1) -> "%12,5"
export function formatPercent(value: number, decimals: number = 1): string {
    const safe = isFinite(value) ? value : 0;
    return `%${formatTrNumber(safe, decimals)}`;
}

// Biçimlenmiş tutarı işaret, sayı ve para birimi simgesine ayırır (kahraman sayıda simge soluk yazılsın diye).
// "1.234,56 ₺" -> { sign: '', symbol: '₺', number: '1.234,56', symbolFirst: false }
// "-$1,234.56" -> { sign: '-', symbol: '$', number: '1,234.56', symbolFirst: true }
// Simge yoksa symbol boş döner.
export function splitCurrencySymbol(formatted: string): { sign: string; number: string; symbol: string; symbolFirst: boolean } {
    const match = /^([+\-−]?)\s*([$₺€])?\s*(.*?)\s*([₺$€])?$/.exec(formatted.trim());
    if (!match) return { sign: '', number: formatted, symbol: '', symbolFirst: false };
    const [, sign, lead, number, trail] = match;
    if (lead) return { sign, number, symbol: lead, symbolFirst: true };
    if (trail) return { sign, number, symbol: trail, symbolFirst: false };
    return { sign, number, symbol: '', symbolFirst: false };
}

// Varlık türü kodlarının ekranda görünen adları
export const ASSET_TYPE_LABELS: Record<string, string> = {
    HISSE: 'Hisse',
    FON: 'Fon',
    ALTIN: 'Altın',
    DOVIZ: 'Döviz',
    ENDEKS: 'Endeks',
};

// Tarih ve saat: "05 Eki 2026 14:30"
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

// Yalnızca tarih: "05 Eki 2026"
export function formatDateOnly(dateStr?: string | Date | null): string {
    if (!dateStr) return '—';
    try {
        const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(d);
    } catch {
        return '—';
    }
}
