-- =============================================================================
-- Migration 002 — Auth Token Columns
-- Adds email verification and password reset token columns to global.users.
-- These are stored as SHA-256 hashes (never the raw token).
-- =============================================================================

ALTER TABLE global.users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON global.users(email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON global.users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL AND deleted_at IS NULL;

INSERT INTO global.schema_migrations (version, description)
VALUES ('002', 'Add email verification and password reset token hash columns to users')
ON CONFLICT (version) DO NOTHING;
