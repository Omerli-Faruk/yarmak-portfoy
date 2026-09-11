-- name: CreatePriceHistory :one
INSERT INTO price_history (asset_id, price, recorded_at)
VALUES ($1, $2, $3)
    RETURNING *;

-- name: GetAssetPriceHistory :many
SELECT * FROM price_history
WHERE asset_id = $1
ORDER BY recorded_at DESC
    LIMIT 5000;

-- name: UpsertPriceHistory :exec
INSERT INTO price_history (asset_id, price, recorded_at)
VALUES ($1, $2, $3)
ON CONFLICT (asset_id, (timezone('UTC', recorded_at)::date)) DO UPDATE
SET price = EXCLUDED.price;

-- name: GetAssetPriceHistoryRange :many
SELECT id, asset_id, price, recorded_at 
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY recorded_at ASC;
-- name: GetAssetPriceHistoryWeekly :many
SELECT DISTINCT ON (date_trunc('week', recorded_at))
    id, asset_id, price, recorded_at
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY date_trunc('week', recorded_at) ASC, recorded_at DESC;

-- name: GetAssetPriceHistoryMonthly :many
SELECT DISTINCT ON (date_trunc('month', recorded_at))
    id, asset_id, price, recorded_at
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY date_trunc('month', recorded_at) ASC, recorded_at DESC;
