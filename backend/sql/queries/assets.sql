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
-- Fiyatı takip edilen varlıklar: işlemi, izleme listesi kaydı ya da bekleyen fiyat alarmı olanlar.
SELECT a.* FROM assets a
WHERE EXISTS (SELECT 1 FROM transactions t WHERE t.asset_id = a.id AND t.deleted_at IS NULL)
   OR EXISTS (SELECT 1 FROM user_watchlists w WHERE w.asset_id = a.id)
   OR EXISTS (SELECT 1 FROM price_alerts p WHERE p.asset_id = a.id AND p.is_triggered = FALSE AND p.deleted_at IS NULL);
