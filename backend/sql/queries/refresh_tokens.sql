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
DELETE FROM refresh_tokens
WHERE expires_at < NOW() OR revoked_at IS NOT NULL;

-- name: RevokeValidRefreshToken :execrows
UPDATE refresh_tokens 
SET revoked_at = NOW(), updated_at = NOW() 
WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW();

-- name: GetUserFromRecentlyRevokedToken :one
SELECT user_id FROM refresh_tokens 
WHERE token = $1 AND revoked_at > NOW() - INTERVAL '30 seconds' AND expires_at > NOW();

-- name: GetUserIDFromRefreshToken :one
SELECT user_id FROM refresh_tokens WHERE token = $1;