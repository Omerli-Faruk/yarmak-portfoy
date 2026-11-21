-- +goose Up
-- 30 saniyelik tolerans yalnızca döndürülen (yenisiyle değiştirilen) token içindir: aynı anda giden paralel
-- isteklerde ikincisi düşmesin diye. Çıkış ya da "tüm cihazlardan çık" ile iptal edilen token da bu toleransa
-- giriyordu; iptalden sonraki 30 saniye boyunca o token'la yeni oturum alınabiliyordu (#21).
ALTER TABLE refresh_tokens ADD COLUMN rotated BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE refresh_tokens DROP COLUMN rotated;
