-- name: CreateTransaction :one
INSERT INTO transactions (user_id, asset_id, type, amount, price, transaction_date)
VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;

-- name: GetUserTransactions :many
SELECT t.*, a.symbol, a.name as asset_name, a.asset_type
FROM transactions t
         JOIN assets a ON t.asset_id = a.id
WHERE t.user_id = $1
ORDER BY t.transaction_date DESC;

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
WHERE t.user_id = $1
GROUP BY a.id, a.symbol, a.name, a.asset_type, a.current_price
HAVING SUM(CASE WHEN t.type = 'BUY' THEN t.amount ELSE -t.amount END) > 0;

-- name: DeleteTransaction :exec
DELETE FROM transactions
WHERE id = $1 AND user_id = $2;