import type {
    Dividend,
    NormalizedAlert,
    NormalizedDividend,
    NormalizedTransaction,
    RawPriceAlert,
    Transaction,
} from '@/types';

// Backend kayıtları bazen PascalCase (Symbol) bazen snake_case (symbol) alanlarla geliyor.
// Bu fonksiyonlar her iki biçimi de okuyup sayısal alanları number'a çevirir.

function toNumber(value?: string): number {
    return parseFloat(value || '0') || 0;
}

export function normalizeTransaction(tx: Transaction): NormalizedTransaction {
    const symbol = tx.Symbol || tx.symbol || '';
    return {
        id: tx.ID ?? tx.id ?? 0,
        symbol,
        assetName: tx.AssetName || tx.asset_name || symbol,
        assetType: (tx.AssetType || tx.asset_type || 'HISSE').toUpperCase(),
        type: (tx.Type || tx.type || 'BUY').toUpperCase(),
        amount: toNumber(tx.Amount || tx.amount),
        price: toNumber(tx.Price || tx.price),
        commission: toNumber(tx.Commission || tx.commission),
        realizedPnl: toNumber(tx.RealizedPnl || tx.realized_pnl),
        date: tx.TransactionDate || tx.transaction_date || tx.CreatedAt || tx.created_at || '',
    };
}

export function normalizeDividend(d: Dividend): NormalizedDividend {
    const gross = toNumber(d.GrossAmount || d.gross_amount || d.Amount || d.amount);
    const tax = toNumber(d.TaxAmount || d.tax_amount);
    // Net tutar gelmezse brütten stopaj düşülür
    const net = parseFloat(d.NetAmount || d.net_amount || String(gross - tax)) || 0;
    return {
        id: d.ID ?? d.id ?? 0,
        symbol: d.Symbol || d.symbol || '',
        assetName: d.AssetName || d.asset_name || '',
        gross,
        tax,
        net,
        date: d.PaymentDate || d.payment_date || d.CreatedAt || d.created_at || '',
    };
}

export function normalizeAlert(a: RawPriceAlert): NormalizedAlert {
    const symbol = a.Symbol ?? a.symbol ?? '';

    // triggered_at, Go tarafındaki sql.NullTime yüzünden { Time, Valid } nesnesi olarak da gelebiliyor
    let triggeredAt: string | null = null;
    const rawTriggered = a.TriggeredAt ?? a.triggered_at;
    if (rawTriggered) {
        if (typeof rawTriggered === 'object' && rawTriggered.Valid && rawTriggered.Time) {
            triggeredAt = rawTriggered.Time;
        } else if (typeof rawTriggered === 'string') {
            triggeredAt = rawTriggered;
        }
    }

    return {
        id: Number(a.ID ?? a.id ?? 0),
        symbol,
        assetName: a.AssetName ?? a.asset_name ?? symbol,
        targetPrice: parseFloat(a.TargetPrice ?? a.target_price ?? '0') || 0,
        currentPrice: parseFloat(a.CurrentPrice ?? a.current_price ?? '0') || 0,
        direction: (a.Direction ?? a.direction ?? 'ABOVE') as 'ABOVE' | 'BELOW',
        isTriggered: Boolean(a.IsTriggered ?? a.is_triggered),
        triggeredAt,
        createdAt: a.CreatedAt ?? a.created_at ?? '',
    };
}
