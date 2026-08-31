-- +goose Up
CREATE INDEX idx_price_history_asset_recorded ON price_history (asset_id, recorded_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_price_history_asset_recorded;
