-- +goose Up
    CREATE TABLE refresh_tokens(
        token VARCHAR(255) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- +goose Down
DROP TABLE IF EXISTS refresh_tokens;
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;