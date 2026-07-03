-- Migration 007: Controls, Compliance Calendar, Expiry Tracker,
--                In-App Notifications, Score Snapshots, Reminder Log
-- Template file — {{SCHEMA}} replaced with actual schema name at provisioning time.

-- ── Controls ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.controls (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id          UUID,
  control_ref           VARCHAR(100) NOT NULL,
  title                 VARCHAR(500) NOT NULL,
  description           TEXT,
  category              VARCHAR(200),
  guidance              TEXT,
  criticality           VARCHAR(20)  NOT NULL DEFAULT 'medium',
    -- critical | high | medium | low
  implementation_status VARCHAR(50)  NOT NULL DEFAULT 'not_implemented',
    -- implemented | partially_implemented | not_implemented | not_applicable | planned
  implementation_notes  TEXT,
  testing_notes         TEXT,
  owner_id              UUID,
  due_date              DATE,
  review_frequency_days INTEGER      DEFAULT 365,
  last_reviewed_at      TIMESTAMPTZ,
  reviewed_by           UUID,
  metadata              JSONB        NOT NULL DEFAULT '{}',
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controls_framework
  ON {{SCHEMA}}.controls (framework_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_controls_status
  ON {{SCHEMA}}.controls (implementation_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_controls_owner
  ON {{SCHEMA}}.controls (owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_controls_due_date
  ON {{SCHEMA}}.controls (due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

-- ── Compliance Calendar Events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.compliance_calendar_events (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(500) NOT NULL,
  description         TEXT,
  event_type          VARCHAR(50)  NOT NULL DEFAULT 'other',
    -- deadline | review | audit | training | renewal | assessment | meeting | other
  status              VARCHAR(50)  NOT NULL DEFAULT 'upcoming',
    -- upcoming | in_progress | completed | cancelled | overdue
  start_date          TIMESTAMPTZ  NOT NULL,
  end_date            TIMESTAMPTZ,
  all_day             BOOLEAN      NOT NULL DEFAULT FALSE,
  is_recurring        BOOLEAN      NOT NULL DEFAULT FALSE,
  recurrence_rule     VARCHAR(500),
  framework_id        UUID,
  linked_entity_type  VARCHAR(50),
    -- control | evidence | policy | audit | vendor | training | expiry_item
  linked_entity_id    UUID,
  assigned_to         UUID,
  priority            VARCHAR(20)  NOT NULL DEFAULT 'medium',
    -- critical | high | medium | low
  color               VARCHAR(7)   NOT NULL DEFAULT '#3B82F6',
  reminder_days       INTEGER[]    NOT NULL DEFAULT '{7,1}',
  metadata            JSONB        NOT NULL DEFAULT '{}',
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start
  ON {{SCHEMA}}.compliance_calendar_events (start_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_status
  ON {{SCHEMA}}.compliance_calendar_events (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned
  ON {{SCHEMA}}.compliance_calendar_events (assigned_to)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_month
  ON {{SCHEMA}}.compliance_calendar_events (DATE_TRUNC('month', start_date))
  WHERE deleted_at IS NULL;

-- ── Expiry Items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.expiry_items (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(500) NOT NULL,
  description   TEXT,
  entity_type   VARCHAR(50)  NOT NULL DEFAULT 'custom',
    -- certificate | policy | contract | evidence | license | insurance |
    -- vendor_agreement | api_key | domain | iso_certification | soc2_report | custom
  entity_id     UUID,
  expiry_date   DATE         NOT NULL,
  renewal_date  DATE,
  owner_id      UUID,
  status        VARCHAR(50)  NOT NULL DEFAULT 'active',
    -- active | expiring_soon | expired | renewed | cancelled
  reminder_days INTEGER[]    NOT NULL DEFAULT '{90,60,30,14,7}',
  auto_detected BOOLEAN      NOT NULL DEFAULT FALSE,
  notes         TEXT,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiry_date
  ON {{SCHEMA}}.expiry_items (expiry_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expiry_status
  ON {{SCHEMA}}.expiry_items (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expiry_entity
  ON {{SCHEMA}}.expiry_items (entity_type, entity_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expiry_owner
  ON {{SCHEMA}}.expiry_items (owner_id)
  WHERE deleted_at IS NULL;

-- ── In-App Notifications ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.notifications (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL,
  title             VARCHAR(500) NOT NULL,
  body              TEXT,
  notification_type VARCHAR(100) NOT NULL,
    -- expiry_warning | calendar_reminder | score_drop | evidence_shared |
    -- control_overdue | system | reminder
  priority          VARCHAR(20)  NOT NULL DEFAULT 'medium',
    -- critical | high | medium | low
  reference_type    VARCHAR(50),
    -- expiry_item | calendar_event | evidence | control
  reference_id      UUID,
  action_url        VARCHAR(1000),
  read_at           TIMESTAMPTZ,
  dismissed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON {{SCHEMA}}.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON {{SCHEMA}}.notifications (user_id, read_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- ── Compliance Score Snapshots ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.compliance_score_snapshots (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date    DATE         NOT NULL,
  overall_score    NUMERIC(5,2),
  framework_scores JSONB        NOT NULL DEFAULT '{}',
    -- { [frameworkId]: { name, score, total, implemented, partial, notImplemented } }
  control_counts   JSONB        NOT NULL DEFAULT '{}',
    -- { total, implemented, partiallyImplemented, notImplemented, notApplicable, planned }
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_date
  ON {{SCHEMA}}.compliance_score_snapshots (snapshot_date DESC);

-- ── Reminder Sent Log (idempotency guard) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.reminder_sent_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     UUID        NOT NULL,
  reminder_type VARCHAR(100) NOT NULL,
  days_before   INTEGER,
  channel       VARCHAR(50) NOT NULL DEFAULT 'email',
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, reminder_type, days_before, channel)
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_entity
  ON {{SCHEMA}}.reminder_sent_log (entity_type, entity_id);
