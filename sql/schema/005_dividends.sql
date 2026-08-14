-- +goose Up
CREATE TABLE dividends
(
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT                   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset_id     BIGINT                   NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    amount       NUMERIC(18, 6)           NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMP WITH TIME ZONE          DEFAULT NULL
);
CREATE INDEX idx_dividends_user_id ON dividends (user_id);
CREATE INDEX idx_dividends_asset_id ON dividends (asset_id);
-- +goose Down
DROP TABLE dividends;