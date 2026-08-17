-- +goose Up
create table splits
(
    id          BIGSERIAL PRIMARY KEY,
    asset_id    BIGINT                   NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    split_ratio NUMERIC(18, 6)           NOT NULL,
    split_date  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE          DEFAULT NULL
);
create index idx_splits_asset_id on splits (asset_id);

-- +goose Down
DROP TABLE IF EXISTS splits;
drop index IF EXISTS idx_splits_asset_id;