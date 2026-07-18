-- Migration 010: Audits & Training (Tenant Schema Template)
-- Applied per-tenant ({{SCHEMA}} replaced at runtime). Idempotent.

-- ============================================================
-- AUDITS (engagements) + FINDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(500)  NOT NULL,
  audit_type    VARCHAR(30)   NOT NULL DEFAULT 'internal'
                  CHECK (audit_type IN ('internal','external','certification','surveillance')),
  framework_ref VARCHAR(100),
  status        VARCHAR(30)   NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','cancelled')),
  auditor_name  VARCHAR(255),
  scope         TEXT,
  summary       TEXT,
  start_date    DATE,
  end_date      DATE,
  owner_id      UUID,
  created_by    UUID,
  updated_by    UUID,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_audits_status ON {{SCHEMA}}.audits(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audits_owner  ON {{SCHEMA}}.audits(owner_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_findings (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id       UUID          NOT NULL REFERENCES {{SCHEMA}}.audits(id) ON DELETE CASCADE,
  title          VARCHAR(500)  NOT NULL,
  description    TEXT,
  severity       VARCHAR(20)   NOT NULL DEFAULT 'medium'
                   CHECK (severity IN ('critical','high','medium','low','observation')),
  status         VARCHAR(20)   NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','in_remediation','resolved','accepted')),
  recommendation TEXT,
  owner_id       UUID,
  due_date       DATE,
  created_by     UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit ON {{SCHEMA}}.audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON {{SCHEMA}}.audit_findings(status);

-- ============================================================
-- TRAINING (programs) + RECORDS (assignments/completions)
-- ============================================================
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.training_programs (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(500)  NOT NULL,
  description      TEXT,
  category         VARCHAR(100),
  provider         VARCHAR(255),
  duration_minutes INTEGER,
  is_mandatory     BOOLEAN       NOT NULL DEFAULT FALSE,
  frequency_days   INTEGER       CHECK (frequency_days IS NULL OR frequency_days > 0),
  status           VARCHAR(20)   NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','archived')),
  owner_id         UUID,
  created_by       UUID,
  updated_by       UUID,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_training_programs_status ON {{SCHEMA}}.training_programs(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.training_records (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID          NOT NULL REFERENCES {{SCHEMA}}.training_programs(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned','in_progress','completed','overdue')),
  score         INTEGER,
  assigned_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_training_records_program ON {{SCHEMA}}.training_records(program_id);
CREATE INDEX IF NOT EXISTS idx_training_records_user    ON {{SCHEMA}}.training_records(user_id);
