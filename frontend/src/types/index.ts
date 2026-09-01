export interface User {
    id: number;
    email: string;
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
}

export interface Transaction {
    id: number;
    asset_id: number;
    symbol: string;
    asset_name: string;
    asset_type: string;
    type: 'BUY' | 'SELL';
    amount: string;
    price: string;
    commission: string;
    realized_pnl: string;
    transaction_date: string;
}

export interface PortfolioSnapshot {
    id: number;
    total_value: string;
    total_cost: string;
    profit_loss: string;
    recorded_at: string;
}