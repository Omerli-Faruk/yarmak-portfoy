-- +goose Up
CREATE TABLE users
(
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets
(
    id            BIGSERIAL PRIMARY KEY,
    symbol        TEXT UNIQUE    NOT NULL,
    name          TEXT           NOT NULL,
    asset_type    TEXT           NOT NULL, -- 'HISSE', 'FON', 'ALTIN', 'DOVIZ'
    current_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions
(
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset_id         BIGINT         NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    type             TEXT           NOT NULL, -- 'BUY' veya 'SELL'
    amount           NUMERIC(15, 4) NOT NULL,
    price            NUMERIC(15, 4) NOT NULL,
    transaction_date TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_history
(
    id          BIGSERIAL PRIMARY KEY,
    asset_id    BIGINT         NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    price       NUMERIC(15, 4) NOT NULL,
    recorded_at TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS users;