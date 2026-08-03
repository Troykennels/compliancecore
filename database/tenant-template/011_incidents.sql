-- =============================================================================
-- Tenant template 011 — Incident management
-- ComplianceCore | ORION SOFT LIMITED
--
-- Security and privacy incident register. Exists to answer the questions every
-- framework asks after something goes wrong: when did we know, who was told,
-- how long did it take, and was the regulator notified in time.
--
-- The regulatory clock fields are first-class columns rather than free text:
-- GDPR Art.33 gives 72 hours to notify a supervisory authority and NDPR/NDPA
-- imposes its own deadline, so "is this one late?" has to be a query, not a
-- judgement call made by reading notes.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS) — applied to new tenants at
-- provisioning and back-filled onto existing ones.
-- =============================================================================

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.incidents (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             VARCHAR(30)   NOT NULL,          -- human handle, e.g. INC-2026-0007
  title                 VARCHAR(500)  NOT NULL,
  description           TEXT,

  category              VARCHAR(40)   NOT NULL DEFAULT 'security'
                          CHECK (category IN ('security','privacy','availability','integrity',
                                              'third_party','physical','fraud','other')),
  severity              VARCHAR(20)   NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('critical','high','medium','low')),
  status                VARCHAR(20)   NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','investigating','contained','resolved','closed')),

  -- Timeline. detected_at is when the organisation became aware, which is what
  -- starts the statutory notification clock — not occurred_at.
  occurred_at           TIMESTAMPTZ,
  detected_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  contained_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,

  -- Personal-data breach handling.
  is_data_breach        BOOLEAN       NOT NULL DEFAULT FALSE,
  affected_data_subjects INTEGER      CHECK (affected_data_subjects IS NULL OR affected_data_subjects >= 0),
  regulator_notified_at  TIMESTAMPTZ,
  data_subjects_notified_at TIMESTAMPTZ,
  -- Hours allowed between detection and regulator notification. Defaults to the
  -- GDPR/NDPR 72-hour rule; per-incident so a stricter sector rule can override.
  notification_deadline_hours INTEGER NOT NULL DEFAULT 72
                          CHECK (notification_deadline_hours > 0),

  reported_by           UUID,
  assigned_to           UUID,
  root_cause            TEXT,
  remediation           TEXT,
  lessons_learned       TEXT,
  affected_systems      TEXT[]        NOT NULL DEFAULT '{}',
  tags                  TEXT[]        NOT NULL DEFAULT '{}',

  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- Reference is unique among live incidents only, so soft-deleting one does not
-- permanently burn its number.
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_reference
  ON {{SCHEMA}}.incidents (reference) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_status    ON {{SCHEMA}}.incidents (status)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_severity  ON {{SCHEMA}}.incidents (severity) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_detected  ON {{SCHEMA}}.incidents (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned  ON {{SCHEMA}}.incidents (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_breach    ON {{SCHEMA}}.incidents (is_data_breach) WHERE is_data_breach = TRUE AND deleted_at IS NULL;

-- ── Incident timeline ────────────────────────────────────────────────────────
-- Append-only log of what was done and when. This is the artefact an auditor
-- reads, so entries are never updated in place.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.incident_updates (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID          NOT NULL REFERENCES {{SCHEMA}}.incidents(id) ON DELETE CASCADE,
  entry_type    VARCHAR(30)   NOT NULL DEFAULT 'note'
                  CHECK (entry_type IN ('note','status_change','severity_change','containment',
                                        'notification','assignment','evidence')),
  body          TEXT          NOT NULL,
  metadata      JSONB         NOT NULL DEFAULT '{}',
  author_id     UUID,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident
  ON {{SCHEMA}}.incident_updates (incident_id, created_at DESC);
