-- name: CreateDividend :one
INSERT INTO dividends (user_id, asset_id, amount, payment_date, gross_amount, tax_amount, net_amount)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: GetUserDividends :many
SELECT d.*, a.symbol, a.name as asset_name
FROM dividends d
         JOIN assets a ON d.asset_id = a.id
WHERE d.user_id = $1 AND d.deleted_at IS NULL
ORDER BY d.payment_date DESC;

-- name: GetTotalDividendsSummary :one
SELECT COALESCE(SUM(net_amount), 0)::text as total_dividends
FROM dividends
WHERE user_id = $1 AND deleted_at IS NULL;

-- name: DeleteDividend :exec
UPDATE dividends
SET deleted_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: UpdateDividend :one
UPDATE dividends
SET asset_id = $3,
    amount = $4,
    payment_date = $5,
    gross_amount = $6,
    tax_amount = $7,
    net_amount = $8
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;