-- +goose Up
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_asset_id ON transactions(asset_id);
CREATE INDEX idx_price_history_asset_id ON price_history(asset_id);

ALTER TABLE assets ADD CONSTRAINT chk_asset_type CHECK (asset_type IN ('HISSE', 'FON', 'ALTIN', 'DOVIZ'));
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_type CHECK (type IN ('BUY', 'SELL'));

-- +goose Down
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transaction_type;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_asset_type;
DROP INDEX IF EXISTS idx_price_history_asset_id;
DROP INDEX IF EXISTS idx_transactions_asset_id;
DROP INDEX IF EXISTS idx_transactions_user_id;
