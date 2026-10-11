import { SLIDER_CONFIG, type CatalogAsset, type TickerType } from '@/data/homeData';
import { formatPriceTR } from '@/lib/formatters';

export interface MarketItem {
    symbol: string;
    label: string;
    type: TickerType;
    price: string;
    change: number;
}

// SLIDER_CONFIG sırasıyla /api/assets fiyatlarından şerit ve tablo satırları üretir.
// Fiyatı olmayan varlık atlanır.
export function buildMarketItems(assets: CatalogAsset[], include?: (type: TickerType) => boolean): MarketItem[] {
    const result: MarketItem[] = [];

    SLIDER_CONFIG.forEach((cfg) => {
        if (include && !include(cfg.type)) return;
        const asset = assets.find((a) => a.symbol === cfg.symbol);
        const price = asset ? parseFloat(asset.current_price) : NaN;
        if (!asset || !(price > 0)) return;

        const change = parseFloat(asset.change);
        result.push({
            symbol: cfg.symbol,
            label: cfg.label,
            type: cfg.type,
            // Endeks puanı TL değildir, ₺ eklenmez
            price: cfg.type === 'index'
                ? price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : formatPriceTR(price),
            change: isNaN(change) ? 0 : change,
        });
    });

    return result;
}
