-- name: AddToBackfillQueue :exec
INSERT INTO backfill_queue (asset_id)
VALUES ($1)
ON CONFLICT (asset_id) DO NOTHING;

-- name: GetNextBackfillTask :one
SELECT * FROM backfill_queue
WHERE status = 'PENDING' OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- name: UpdateBackfillTaskStatus :exec
UPDATE backfill_queue
SET status = $2, error_message = $3, updated_at = NOW()
WHERE id = $1;

-- name: AddToWatchlist :exec
INSERT INTO user_watchlists (user_id, asset_id)
VALUES ($1, $2)
ON CONFLICT (user_id, asset_id) DO NOTHING;
