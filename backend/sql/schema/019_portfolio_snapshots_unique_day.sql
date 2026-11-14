-- +goose Up
-- Kullanıcı başına günde (İstanbul saatiyle) tek portföy özeti. "Bugün yazıldı" bilgisi yalnızca bellekte
-- tutulduğu için sunucu akşam yeniden başlayınca aynı gün ikinci kez yazılıyordu. Önce tekrarlar temizlenir
-- (günün en geç kaydı kalır), sonra kural veritabanına konur; yazma tarafı ON CONFLICT ile günceller.
DELETE FROM portfolio_snapshots a USING portfolio_snapshots b
WHERE a.user_id = b.user_id
  AND timezone('Europe/Istanbul', a.recorded_at)::date = timezone('Europe/Istanbul', b.recorded_at)::date
  AND (a.recorded_at < b.recorded_at OR (a.recorded_at = b.recorded_at AND a.id < b.id));

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_day
ON portfolio_snapshots (user_id, (timezone('Europe/Istanbul', recorded_at)::date));

-- +goose Down
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_day;
