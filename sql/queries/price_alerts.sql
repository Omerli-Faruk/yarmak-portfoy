-- name: CreatePriceAlert :one
INSERT INTO price_alerts (user_id, asset_id, target_price, direction) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetUserPriceAlert :many
SELECT pa.*, a.symbol, a.name as asset_name, a.current_price
FROM price_alerts pa
         JOIN assets a ON pa.asset_id = a.id
WHERE pa.user_id = $1 AND pa.deleted_at IS NULL
ORDER BY pa.created_at DESC;

-- name: GetPendingAlertsForAsset :many
SELECT * FROM price_alerts
WHERE asset_id = $1 AND is_triggered = FALSE AND deleted_at IS NULL;

-- name: MarkAlertTriggered :exec
UPDATE price_alerts SET is_triggered = TRUE, triggered_at = NOW() WHERE id = $1;

-- name: DeletePriceAlert :exec
UPDATE price_alerts SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;