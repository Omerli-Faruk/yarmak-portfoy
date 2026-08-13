-- +goose Up
ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- +goose Down
ALTER TABLE transactions DROP COLUMN deleted_at;