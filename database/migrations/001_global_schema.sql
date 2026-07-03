-- =============================================================================
-- Migration 001 — Global Schema Bootstrap
-- ComplianceCore | ORION SOFT LIMITED
-- Run this first on a fresh database before any other migrations.
-- Idempotent: uses IF NOT EXISTS throughout.
-- =============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS global;
CREATE SCHEMA IF NOT EXISTS framework_data;

-- Install required extensions. Each is attempted independently so that a
-- failure (e.g. `vector` on an image without pgvector, or `pg_stat_statements`
-- when it is not in shared_preload_libraries) only warns rather than aborting
-- the whole bootstrap. gen_random_uuid() is built into Postgres 13+, so table
-- defaults do not hard-depend on pgcrypto.
DO $$
DECLARE ext text;
BEGIN
  FOREACH ext IN ARRAY ARRAY['pgcrypto','uuid-ossp','vector','pg_trgm','btree_gin','pg_stat_statements'] LOOP
    BEGIN
      EXECUTE format('CREATE EXTENSION IF NOT EXISTS %I', ext);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not create extension %: %', ext, SQLERRM;
    END;
  END LOOP;
END $$;

-- Create application role (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compliancecore_app') THEN
        CREATE ROLE compliancecore_app LOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'compliancecore_readonly') THEN
        CREATE ROLE compliancecore_readonly LOGIN;
    END IF;
END;
$$;

-- Grant schema usage
GRANT USAGE ON SCHEMA global TO compliancecore_app;
GRANT USAGE ON SCHEMA framework_data TO compliancecore_app;
GRANT USAGE ON SCHEMA framework_data TO compliancecore_readonly;

-- Record this migration
CREATE TABLE IF NOT EXISTS global.schema_migrations (
    version     VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_schema_migrations PRIMARY KEY (version)
);

INSERT INTO global.schema_migrations (version, description)
VALUES ('001', 'Global schema bootstrap — extensions, roles, schemas')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- Migration 002 — Tenant Template
-- After running schema.sql, run this to apply the tenant template tables
-- to each existing tenant schema via the migration runner.
-- =============================================================================
-- The tenant schema migration runner (database/migrations/runner.ts):
--   1. Queries SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL
--   2. For each schema, runs: SET search_path = {schema_name}
--   3. Applies each pending tenant migration SQL file
--   4. Records applied migrations in a per-tenant migrations table
