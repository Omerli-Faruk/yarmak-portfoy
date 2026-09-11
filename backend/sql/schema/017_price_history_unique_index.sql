-- +goose Up
DELETE FROM price_history a USING price_history b
WHERE a.asset_id = b.asset_id
  AND (timezone('UTC', a.recorded_at)::date) = (timezone('UTC', b.recorded_at)::date)
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_asset_date 
ON price_history (asset_id, (timezone('UTC', recorded_at)::date));

-- +goose Down
DROP INDEX IF EXISTS idx_price_history_asset_date;