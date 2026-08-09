-- name: CreateAsset :one
INSERT INTO assets (symbol, name, asset_type, current_price)
VALUES ($1, $2, $3, $4)
    RETURNING *;

-- name: GetAssetBySymbol :one
SELECT * FROM assets
WHERE symbol = $1;

-- name: GetAssetByID :one
SELECT * FROM assets
WHERE id = $1;

-- name: ListAssets :many
SELECT * FROM assets
ORDER BY symbol ASC;

-- name: UpdateAssetPrice :one
UPDATE assets
SET current_price = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
    RETURNING *;