-- =============================================================================
-- Migration 003 — Tenant Profile Fields
-- Adds company profile columns to global.tenants.
-- =============================================================================

ALTER TABLE global.tenants
  ADD COLUMN IF NOT EXISTS industry              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS website               VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone                 VARCHAR(50),
  ADD COLUMN IF NOT EXISTS country               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address               TEXT,
  ADD COLUMN IF NOT EXISTS postal_code           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS size                  VARCHAR(20),   -- '1-10','11-50','51-200','201-500','501-1000','1001+'
  ADD COLUMN IF NOT EXISTS logo_url              TEXT,
  ADD COLUMN IF NOT EXISTS timezone              VARCHAR(100) NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS date_format           VARCHAR(20)  NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS data_residency_region VARCHAR(50)  NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS notification_settings JSONB        NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tenants_country
  ON global.tenants(country) WHERE deleted_at IS NULL;

INSERT INTO global.schema_migrations (version, description)
VALUES ('003', 'Add company profile fields to global.tenants')
ON CONFLICT (version) DO NOTHING;
