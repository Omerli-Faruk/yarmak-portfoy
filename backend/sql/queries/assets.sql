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

-- name: UpdateAssetType :one
UPDATE assets
SET asset_type = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
    RETURNING *;

-- name: UpsertAsset :one
INSERT INTO assets (symbol, name, asset_type, current_price)
VALUES ($1, $2, $3, $4)
ON CONFLICT (symbol) DO UPDATE
SET name = EXCLUDED.name,
    current_price = EXCLUDED.current_price,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
-- name: GetActiveAssets :many
SELECT DISTINCT a.* FROM assets a LEFT JOIN transactions t ON a.id = t.asset_id LEFT JOIN user_watchlists w ON a.id = w.asset_id WHERE (t.id IS NOT NULL AND t.deleted_at IS NULL) OR w.id IS NOT NULL;
