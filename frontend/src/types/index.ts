export interface User {
    id: number;
    email: string;
    username: string;
    role: string;
    created_at: string;
}

export interface AuthResponse {
    token: string;
    refresh_token: string;
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