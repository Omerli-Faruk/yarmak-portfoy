export interface User {
    id: number;
    email: string;
    username: string;
    role: string;
    created_at: string;
}

// Oturum çerezlerle taşınıyor; giriş yanıtında yalnızca kullanıcı bilgisi döner.
export interface AuthResponse {
    user: User;
}

export interface UserHolding {
    asset_id: number;
    symbol: string;
    asset_name: string;
    asset_type: 'HISSE' | 'FON' | 'ALTIN' | 'DOVIZ';
    current_price: number;
    total_amount: number;
    average_cost: number;
    total_value: number;
    profit_loss: number;
    first_buy_date?: string;
}

export interface CategorySummary {
    value: number;
    cost: number;
    profit_loss: number;
}

export interface PortfolioSummary {
    total_value: number;
    total_equity_value?: number;
    total_cost: number;
    capital_profit_loss: number;
    capital_profit_loss_percentage: number;
    realized_profit_loss: number;
    total_dividends: number;
    total_combined_profit: number;
    total_return_percentage: number;
    holdings_count: number;
    breakdown: Record<string, CategorySummary>;
    usd_rate: number;
    total_value_usd: number;
    total_combined_profit_usd: number;
    total_commission: number;
    period_returns?: Record<string, number>;
    period_values?: Record<string, number>;
}

export interface Transaction {
    id?: number;
    ID?: number;
    user_id?: number;
    UserID?: number;
    asset_id?: number;
    AssetID?: number;
    symbol?: string;
    Symbol?: string;
    asset_name?: string;
    AssetName?: string;
    asset_type?: string;
    AssetType?: string;
    type?: 'BUY' | 'SELL' | string;
    Type?: 'BUY' | 'SELL' | string;
    amount?: string;
    Amount?: string;
    price?: string;
    Price?: string;
    commission?: string;
    Commission?: string;
    realized_pnl?: string;
    RealizedPnl?: string;
    transaction_date?: string;
    TransactionDate?: string;
    created_at?: string;
    CreatedAt?: string;
}

export interface PortfolioSnapshot {
    id: number;
    total_value: string;
    total_cost: string;
    profit_loss: string;
    recorded_at: string;
}

export interface AssetGroup {
    id: string;
    name: string;
    color: string;
}

export interface Dividend {
    id?: number;
    ID?: number;
    user_id?: number;
    UserID?: number;
    asset_id?: number;
    AssetID?: number;
    symbol?: string;
    Symbol?: string;
    asset_name?: string;
    AssetName?: string;
    amount?: string;
    Amount?: string;
    gross_amount?: string;
    GrossAmount?: string;
    tax_amount?: string;
    TaxAmount?: string;
    net_amount?: string;
    NetAmount?: string;
    payment_date?: string;
    PaymentDate?: string;
    created_at?: string;
    CreatedAt?: string;
}

export type Period = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | 'ALL';

// Sembol -> { '1D': getiri %, '1W': ..., 'ALL': ... }
export type AssetSummaryMap = Record<string, Record<string, number>>;

// lib/normalize.ts çıktıları: backend'in PascalCase / snake_case alanları tek biçime indirilmiş hali.
export interface NormalizedTransaction {
    id: number;
    symbol: string;
    assetName: string;
    assetType: string;
    type: string; // 'BUY' | 'SELL', büyük harfe çevrilmiş
    amount: number;
    price: number;
    commission: number;
    realizedPnl: number;
    date: string;
}

export interface NormalizedDividend {
    id: number;
    symbol: string;
    assetName: string;
    gross: number;
    tax: number;
    net: number;
    date: string;
}

// /alerts yanıtındaki ham kayıt; alanlar bazen PascalCase bazen snake_case geliyor.
export interface RawPriceAlert {
    ID?: number;
    id?: number;
    UserID?: number;
    user_id?: number;
    AssetID?: number;
    asset_id?: number;
    TargetPrice?: string;
    target_price?: string;
    Direction?: 'ABOVE' | 'BELOW';
    direction?: 'ABOVE' | 'BELOW';
    IsTriggered?: boolean;
    is_triggered?: boolean;
    TriggeredAt?: { Time: string; Valid: boolean } | string | null;
    triggered_at?: { Time: string; Valid: boolean } | string | null;
    CreatedAt?: string;
    created_at?: string;
    Symbol?: string;
    symbol?: string;
    AssetName?: string;
    asset_name?: string;
    CurrentPrice?: string;
    current_price?: string;
}

export interface NormalizedAlert {
    id: number;
    symbol: string;
    assetName: string;
    targetPrice: number;
    currentPrice: number;
    direction: 'ABOVE' | 'BELOW';
    isTriggered: boolean;
    triggeredAt: string | null;
    createdAt: string;
}

// /api/markets yanıtındaki endeks ve varlık satırları
export interface MarketIndexItem {
    symbol: string;
    name: string;
    price: number;
    change: string;
    positive: boolean;
}

export interface MarketAssetItem {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    price: number;
    change: string;
    change_value: number;
    positive: boolean;
    volume?: string;
}