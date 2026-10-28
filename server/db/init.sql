-- Starter schema. Extend one table at a time and keep this file in step with C8.
-- Passwords are stored only as salted hashes (never plain text).
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT 'user'
                CHECK (platform_role IN ('user', 'administrator')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
