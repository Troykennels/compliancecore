-- =============================================================================
-- Migration 005 — Framework Reference Data (global `framework_data` schema)
-- ComplianceCore | ORION SOFT LIMITED
--
-- The `framework_data` schema is created empty by migration 001 but no table
-- was ever defined for it, so seeds/frameworks.sql (which INSERTs into
-- framework_data.frameworks / framework_categories) previously aborted with
-- "relation ... does not exist". This migration creates those tables.
--
-- These tables are shared reference data (the Universal Control Framework
-- catalogue) — read by every tenant via the `framework_data` entry in the
-- per-request search_path. This is a GLOBAL migration (no tenant placeholder)
-- applied once by scripts/migrate.mjs, NOT a per-tenant template.
-- Idempotent: IF NOT EXISTS throughout.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS framework_data;

-- ── FRAMEWORKS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS framework_data.frameworks (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50)  NOT NULL,
  name           VARCHAR(500) NOT NULL,
  short_name     VARCHAR(100),
  version        VARCHAR(50),
  jurisdiction   VARCHAR(200),
  issuing_body   VARCHAR(200),
  description    TEXT,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_date DATE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- `code` uniquely identifies a framework and is the conflict target used by the
-- seed so re-seeding is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_frameworks_code ON framework_data.frameworks (code);
CREATE INDEX IF NOT EXISTS idx_frameworks_active ON framework_data.frameworks (is_active) WHERE deleted_at IS NULL;

-- ── FRAMEWORK CATEGORIES (themes / criteria / clauses) ───────────────────────
CREATE TABLE IF NOT EXISTS framework_data.framework_categories (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID         NOT NULL REFERENCES framework_data.frameworks(id) ON DELETE CASCADE,
  code         VARCHAR(50)  NOT NULL,
  name         VARCHAR(500) NOT NULL,
  description  TEXT,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_framework_categories_code
  ON framework_data.framework_categories (framework_id, code);
CREATE INDEX IF NOT EXISTS idx_framework_categories_framework
  ON framework_data.framework_categories (framework_id);

-- ── FRAMEWORK CONTROLS (individual requirements within a framework) ──────────
-- Referenced by tenant `controls.framework_id`/reporting joins as the catalogue
-- of source controls. Kept minimal; populated by dedicated control seed files.
CREATE TABLE IF NOT EXISTS framework_data.framework_controls (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID         NOT NULL REFERENCES framework_data.frameworks(id) ON DELETE CASCADE,
  category_id  UUID         REFERENCES framework_data.framework_categories(id) ON DELETE SET NULL,
  control_ref  VARCHAR(100) NOT NULL,
  title        VARCHAR(1000) NOT NULL,
  description  TEXT,
  guidance     TEXT,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_framework_controls_ref
  ON framework_data.framework_controls (framework_id, control_ref);
CREATE INDEX IF NOT EXISTS idx_framework_controls_framework
  ON framework_data.framework_controls (framework_id);

-- Grant read access to the application roles (roles created in migration 001).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compliancecore_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA framework_data TO compliancecore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compliancecore_readonly') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA framework_data TO compliancecore_readonly;
  END IF;
END $$;
