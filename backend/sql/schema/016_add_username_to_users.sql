-- +goose Up
ALTER TABLE users ADD COLUMN username VARCHAR(50);
UPDATE users SET username = split_part(email, '@', 1) || '_' || id WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users DROP COLUMN username;
