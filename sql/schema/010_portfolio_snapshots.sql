-- +goose Up
create table portfolio_snapshots
(
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT                   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    total_value NUMERIC(18, 6)           NOT NULL,
    total_cost  NUMERIC(18, 6)           NOT NULL,
    profit_loss NUMERIC(18, 6)           NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_portfolio_snapshots_user_recorded ON portfolio_snapshots (user_id, recorded_at DESC);
-- +goose Down
DROP TABLE IF EXISTS portfolio_snapshots;
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_recorded;