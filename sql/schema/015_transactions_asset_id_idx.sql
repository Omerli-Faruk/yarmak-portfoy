-- +goose Up
CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions (asset_id);
-- +goose Down
DROP INDEX IF EXISTS idx_transactions_asset_id;