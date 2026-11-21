-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (token, user_id, expires_at, created_at, updated_at)
VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *;

-- name: GetUserFromRefreshToken :one
SELECT u.*
FROM users u
         JOIN refresh_tokens rt ON u.id = rt.user_id
WHERE rt.token = $1
  AND rt.revoked_at IS NULL
  AND rt.expires_at > NOW();

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked_at = NOW(), updated_at = NOW()
WHERE token = $1;

-- name: DeleteExpiredRefreshTokens :exec
-- İptal edilmiş token'lar 7 gün tutulur: bu sürede yeniden kullanılırsa çalınmış sayılıp kullanıcının bütün
-- oturumları kapatılır (GetUserFromRevokedToken). Eskiden iptal edilenler saatlik temizlikte hemen siliniyordu.
DELETE FROM refresh_tokens
WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '7 days';

-- name: RevokeValidRefreshToken :execrows
-- Döndürme: token yenisiyle değiştirilirken iptal edilir ve rotated işaretlenir (tolerans yalnız bunlara).
UPDATE refresh_tokens
SET revoked_at = NOW(), rotated = true, updated_at = NOW()
WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW();

-- name: GetUserFromRecentlyRevokedToken :one
-- Son 30 saniyede DÖNDÜRÜLMÜŞ token: paralel istekte oturum düşmesin. Çıkışla iptal edilen token buraya girmez.
SELECT user_id FROM refresh_tokens
WHERE token = $1 AND rotated AND revoked_at > NOW() - INTERVAL '30 seconds' AND expires_at > NOW();

-- name: GetUserIDFromRefreshToken :one
SELECT user_id FROM refresh_tokens WHERE token = $1;

-- name: GetUserFromRevokedToken :one
-- Tolerans süresi (30 sn) dışında iptal edilmiş bir token'ın sahibi. Döndürülmüş bir token'ın tekrar gelmesi,
-- token'ın başka birinin elinde olabileceği anlamına gelir.
SELECT user_id FROM refresh_tokens
WHERE token = $1 AND revoked_at IS NOT NULL;

-- name: RevokeAllUserRefreshTokens :execrows
UPDATE refresh_tokens
SET revoked_at = NOW(), updated_at = NOW()
WHERE user_id = $1 AND revoked_at IS NULL;
