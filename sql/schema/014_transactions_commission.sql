-- +goose Up
ALTER TABLE transactions ADD COLUMN commission NUMERIC(18, 6) NOT NULL DEFAULT 0.000000;

-- +goose Down
ALTER TABLE transactions DROP COLUMN IF EXISTS commission;