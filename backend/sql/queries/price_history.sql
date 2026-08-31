-- name: CreatePriceHistory :one
INSERT INTO price_history (asset_id, price, recorded_at)
VALUES ($1, $2, $3)
    RETURNING *;

-- name: GetAssetPriceHistory :many
SELECT * FROM price_history
WHERE asset_id = $1
ORDER BY recorded_at DESC
    LIMIT 500;