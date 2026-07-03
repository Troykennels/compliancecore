-- =============================================================================
-- Migration 005 — Branches and Departments (Tenant Schema Template)
-- These tables are created inside each tenant schema (tenant_{uuid}).
-- This migration should be applied via the tenant provisioning service
-- (fn_create_tenant_schema) for every new tenant, and run against existing
-- tenant schemas as a one-time backfill during upgrades.
-- =============================================================================

-- The provisioning function uses a schema name substitution pattern.
-- When called for a specific tenant, replace {{SCHEMA}} with the tenant
-- schema name, e.g. tenant_abc123.

-- BRANCHES ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.branches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  code             VARCHAR(50)  UNIQUE,
  is_headquarters  BOOLEAN      NOT NULL DEFAULT FALSE,
  country          VARCHAR(100),
  city             VARCHAR(100),
  state            VARCHAR(100),
  address          TEXT,
  postal_code      VARCHAR(20),
  timezone         VARCHAR(100) NOT NULL DEFAULT 'UTC',
  phone            VARCHAR(50),
  email            VARCHAR(255),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by       UUID,
  updated_by       UUID,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_branches_active
  ON {{SCHEMA}}.branches(is_active) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_hq
  ON {{SCHEMA}}.branches(is_headquarters)
  WHERE is_headquarters = TRUE AND deleted_at IS NULL;

-- Only one branch can be marked as headquarters at a time (enforced by partial unique index above).

-- DEPARTMENTS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.departments (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  code                  VARCHAR(50)  UNIQUE,
  branch_id             UUID         REFERENCES {{SCHEMA}}.branches(id) ON DELETE SET NULL,
  parent_department_id  UUID         REFERENCES {{SCHEMA}}.departments(id) ON DELETE SET NULL,
  head_user_id          UUID,        -- FK to global.users (cross-schema, enforced at app level)
  description           TEXT,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_departments_branch
  ON {{SCHEMA}}.departments(branch_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_departments_parent
  ON {{SCHEMA}}.departments(parent_department_id) WHERE deleted_at IS NULL;

