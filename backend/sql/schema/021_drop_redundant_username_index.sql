-- +goose Up
-- users.username zaten UNIQUE kısıtı taşıyor ve Postgres bunun için users_username_key index'ini kendisi kuruyor.
-- Eski bir migration'dan kalan idx_users_username aynı sütunda ikinci index: aramaya bir şey katmıyor, her yazmada
-- boşuna güncelleniyor (#20). Migration dosyası sonradan silindiği için yalnızca eski veritabanlarında var.
DROP INDEX IF EXISTS idx_users_username;

-- +goose Down
-- Bilerek boş: yeni kurulumlarda bu index hiç yoktu, geri almak eski fazlalığı yeniden üretmek olur.
SELECT 1;
