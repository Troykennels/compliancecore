-- =============================================================================
-- Tenant template 012 — Scheduled reports
-- ComplianceCore | ORION SOFT LIMITED
--
-- This table was created lazily, at request time, by ensureTable() in
-- reports.repository.ts — the same pattern that took CI and four deploys down
-- when a migration referenced a table nothing had provisioned yet.
--
-- Here it was quieter and arguably worse. A tenant provisioned today has no
-- scheduled_reports table until somebody happens to open the Scheduled Reports
-- screen, and the delivery job swallows the resulting "relation does not exist"
-- with a catch that returns an empty list. So the job ran, found nothing, and
-- reported success — for a customer who had configured nothing yet, which is
-- indistinguishable from a customer whose reports silently never send.
--
-- Provisioning it here also lets migrate-tenants.mjs back-fill every existing
-- tenant, which it could not do while the definition lived in TypeScript.
-- =============================================================================

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.scheduled_reports (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    frequency       VARCHAR(20)  NOT NULL,
    day_of_week     INTEGER,
    day_of_month    INTEGER,
    hour            INTEGER      NOT NULL DEFAULT 6,
    recipients      TEXT[]       NOT NULL DEFAULT '{}',
    format          VARCHAR(10)  NOT NULL DEFAULT 'pdf',
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    next_run_at     TIMESTAMPTZ,
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(20),
    created_by      UUID,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT scheduled_reports_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT scheduled_reports_format    CHECK (format IN ('pdf', 'excel', 'both')),
    CONSTRAINT scheduled_reports_hour      CHECK (hour BETWEEN 0 AND 23)
);

-- The delivery job scans for rows that are due, across every tenant, on a
-- schedule. Without this it is a sequential scan per tenant per run.
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_due
    ON {{SCHEMA}}.scheduled_reports (next_run_at)
    WHERE is_active;
