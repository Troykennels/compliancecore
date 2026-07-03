-- =============================================================================
-- Migration 004 — API Keys and Webhooks
-- Creates global.api_keys and global.webhooks tables.
-- =============================================================================

CREATE TABLE IF NOT EXISTS global.api_keys (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
  created_by    UUID          NOT NULL REFERENCES global.users(id)   ON DELETE RESTRICT,
  name          VARCHAR(100)  NOT NULL,
  key_hash      VARCHAR(64)   NOT NULL UNIQUE,
  key_prefix    VARCHAR(16)   NOT NULL,   -- first 16 chars of raw key, shown in UI
  permissions   TEXT[]        NOT NULL DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON global.api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash   ON global.api_keys(key_hash);

CREATE TABLE IF NOT EXISTS global.webhooks (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
  created_by       UUID         NOT NULL REFERENCES global.users(id)   ON DELETE RESTRICT,
  name             VARCHAR(100) NOT NULL,
  url              TEXT         NOT NULL,
  secret_hash      VARCHAR(64)  NOT NULL,
  events           TEXT[]       NOT NULL DEFAULT '{}',
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  last_status_code  INTEGER,
  failure_count    INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON global.webhooks(tenant_id) WHERE is_active = TRUE;

INSERT INTO global.schema_migrations (version, description)
VALUES ('004', 'Add api_keys and webhooks tables')
ON CONFLICT (version) DO NOTHING;
