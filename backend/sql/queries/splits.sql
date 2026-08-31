-- name: CreateSplit :one
INSERT INTO splits (asset_id, split_ratio, split_date)
VALUES ($1, $2, $3) RETURNING *;

-- name: ListSplitsByAsset :many
SELECT *
FROM splits
WHERE asset_id = $1
  and deleted_at is null
ORDER BY split_date DESC;

-- name: ApplyStockSplitToTransactions :exec
UPDATE transactions
SET amount = amount * $2,
    price = price / $2
WHERE asset_id = $1 AND transaction_date <= $3 AND deleted_at IS NULL;