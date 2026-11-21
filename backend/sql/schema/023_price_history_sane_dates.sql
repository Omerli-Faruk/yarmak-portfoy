-- +goose Up
-- Go'da tarih okunamayınca sıfır değerli time.Time (0001-01-01) yazılabiliyor; canlıda AAL ve AAV fonlarında birer
-- kayıt vardı (#39). Hangi eski kod yolundan geldiği kesin bulunamadı, bugünkü yazma yolları sıfır tarih üretmiyor.
-- Korumayı veritabanına koyuyoruz: bozuk kayıt silinir, bundan sonra 1990 öncesi tarih yazılmak istenirse hata verir.
DELETE FROM price_history WHERE recorded_at < '1990-01-01';
ALTER TABLE price_history ADD CONSTRAINT price_history_recorded_at_sane CHECK (recorded_at >= '1990-01-01');

-- +goose Down
ALTER TABLE price_history DROP CONSTRAINT IF EXISTS price_history_recorded_at_sane;
