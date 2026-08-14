-- name: CreateDividend :one
INSERT INTO dividends (user_id, asset_id, amount, payment_date)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetUserDividends :many
SELECT d.*, a.symbol, a.name as asset_name
FROM dividends d
         JOIN assets a ON d.asset_id = a.id
WHERE d.user_id = $1 AND d.deleted_at IS NULL
ORDER BY d.payment_date DESC;

-- name: GetTotalDividendsSummary :one
SELECT COALESCE(SUM(amount), 0)::text as total_dividends
FROM dividends
WHERE user_id = $1 AND deleted_at IS NULL;

-- name: DeleteDividend :exec
UPDATE dividends
SET deleted_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;