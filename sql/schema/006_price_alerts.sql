-- +goose Up
create table price_alerts
(
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT                   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id     BIGINT                   NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    target_price NUMERIC(18, 6)           NOT NULL,
    direction    VARCHAR(10)              NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
    is_triggered BOOLEAN                  NOT NULL DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE          DEFAULT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMP WITH TIME ZONE          DEFAULT NULL
);

CREATE INDEX idx_priceAlerts_user_id ON price_alerts (user_id);
CREATE INDEX idx_priceAlerts_asset_id ON price_alerts (asset_id);
CREATE INDEX idx_priceAlerts_is_triggered ON price_alerts (is_triggered);
-- +goose Down
DROP INDEX IF EXISTS idx_priceAlerts_user_id;
DROP INDEX IF EXISTS idx_priceAlerts_asset_id;
DROP INDEX IF EXISTS idx_priceAlerts_is_triggered;
DROP TABLE price_alerts;