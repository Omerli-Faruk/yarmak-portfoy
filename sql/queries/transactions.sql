-- name: CreateTransaction :one
INSERT INTO transactions (user_id, asset_id, type, amount, price, transaction_date, realized_pnl, commission)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;

-- name: GetUserTransactionsPaginated :many
SELECT t.*, a.symbol, a.name as asset_name, a.asset_type
FROM transactions t
         JOIN assets a ON t.asset_id = a.id
WHERE t.user_id = $1 AND t.deleted_at IS NULL
ORDER BY t.transaction_date DESC
    LIMIT $2 OFFSET $3;

-- name: GetUserHoldingsSummary :many
SELECT
    a.id as asset_id,
    a.symbol,
    a.name as asset_name,
    a.asset_type,
    a.current_price,
    SUM(CASE WHEN t.type = 'BUY' THEN t.amount ELSE -t.amount END)::text as total_amount,
    COALESCE((SUM(CASE WHEN t.type = 'BUY' THEN t.amount * t.price ELSE 0 END) /
    NULLIF(SUM(CASE WHEN t.type = 'BUY' THEN t.amount ELSE 0 END), 0))::text, '0.0000') as average_cost
FROM transactions t
         JOIN assets a ON t.asset_id = a.id
WHERE t.user_id = $1 AND t.deleted_at IS NULL
GROUP BY a.id, a.symbol, a.name, a.asset_type, a.current_price
HAVING SUM(CASE WHEN t.type = 'BUY' THEN t.amount ELSE -t.amount END) > 0;

-- name: DeleteTransaction :exec
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: GetTransactionByIDAndUser :one
SELECT * FROM transactions
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: GetTotalRealizedPnL :one
SELECT COALESCE(SUM(realized_pnl), 0)::text as total_realized_pnl
FROM transactions
WHERE user_id = $1 AND type = 'SELL' AND deleted_at IS NULL;