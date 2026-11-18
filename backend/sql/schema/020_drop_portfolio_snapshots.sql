-- +goose Up
-- Günlük portföy fotoğrafı tablosu kaldırılıyor. Ön yüz okumuyordu: portföy grafiği istek anında fiyat
-- geçmişi ve işlemlerden hesaplanıyor (/portfolio/value-history). 999 farklı portföyle yük testi:
-- backend/cmd/loadtest/SONUCLAR.md, bölüm 3.
DROP TABLE IF EXISTS portfolio_snapshots;

-- +goose Down
-- Geri almada tablo ve iki indeksi (010 ve 019) boş olarak yeniden kurulur; silinen satırlar geri gelmez.
CREATE TABLE IF NOT EXISTS portfolio_snapshots
(
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT                   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    total_value NUMERIC(18, 6)           NOT NULL,
    total_cost  NUMERIC(18, 6)           NOT NULL,
    profit_loss NUMERIC(18, 6)           NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_recorded ON portfolio_snapshots (user_id, recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_day
    ON portfolio_snapshots (user_id, (timezone('Europe/Istanbul', recorded_at)::date));
