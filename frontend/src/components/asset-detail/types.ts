// Varlık detay sayfasında /api/assets ve /api/assets/detail yanıtlarından okunan alanlar

export interface AssetDetailInfo {
    id?: number;
    ID?: number;
    symbol?: string;
    Symbol?: string;
    name?: string;
    Name?: string;
    asset_type?: string;
    AssetType?: string;
    current_price?: string;
    CurrentPrice?: string;
    change?: string;
    positive?: boolean;
}

export interface AssetFundamentals {
    marketCap?: string;
    peRatio?: string;
    dividendYield?: string;
    dividendRate?: string;
    exDividendDate?: string;
    isExDateFuture?: string;
    exDividendLabel?: string;
    beta?: string;
    fiftyTwoWeekHigh?: string;
    fiftyTwoWeekLow?: string;
    volume?: string;
    isStale?: boolean;
    staleMessage?: string;
    lastUpdateDate?: string;
}

export interface AssetChartItem {
    date: string;
    price: number;
}

// XU100 ve XU030 TL değil endeks puanıdır. Veritabanındaki kayıt farklı bir türle de
// açılmış olabileceği için türün yanında sembole de bakılır.
export function isIndexAsset(symbol: string, assetType?: string): boolean {
    return assetType === 'ENDEKS' || symbol === 'XU100' || symbol === 'XU030';
}

// Endeks puanı ₺ olmadan yazılır: "10.250,35"
export function formatIndexPoints(value: number): string {
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
