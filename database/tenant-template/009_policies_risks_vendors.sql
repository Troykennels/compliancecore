-- Migration 009: Policies, Risks, Vendors (Tenant Schema Template)
-- Applied per-tenant ({{SCHEMA}} replaced at runtime). Idempotent.

-- ============================================================
-- POLICIES
-- ============================================================
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.policies (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(500)  NOT NULL,
  description           TEXT,
  document_type         VARCHAR(50)   NOT NULL DEFAULT 'policy'
                          CHECK (document_type IN ('policy','procedure','standard','guideline')),
  status                VARCHAR(30)   NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','in_review','approved','published','archived')),
  content               TEXT,
  current_version       INTEGER       NOT NULL DEFAULT 1 CHECK (current_version >= 0),
  owner_id              UUID,
  review_due_date       DATE,
  review_frequency_days INTEGER       NOT NULL DEFAULT 365 CHECK (review_frequency_days > 0),
  framework_ids         TEXT[]        NOT NULL DEFAULT '{}',
  tags                  TEXT[]        NOT NULL DEFAULT '{}',
  approved_at           TIMESTAMPTZ,
  approved_by           UUID,
  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_policies_status ON {{SCHEMA}}.policies(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_owner  ON {{SCHEMA}}.policies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_review ON {{SCHEMA}}.policies(review_due_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.policy_versions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      UUID         NOT NULL REFERENCES {{SCHEMA}}.policies(id) ON DELETE CASCADE,
  version_number INTEGER      NOT NULL,
  content        TEXT,
  change_note    TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON {{SCHEMA}}.policy_versions(policy_id);

-- ============================================================
-- RISKS
-- ============================================================
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.risks (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title                VARCHAR(500)  NOT NULL,
  description          TEXT,
  category             VARCHAR(50)   NOT NULL DEFAULT 'operational'
                         CHECK (category IN ('operational','strategic','financial','compliance','security','privacy','reputational','third_party')),
  inherent_likelihood  INTEGER       NOT NULL DEFAULT 3 CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact      INTEGER       NOT NULL DEFAULT 3 CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score       INTEGER       NOT NULL DEFAULT 9,
  treatment            VARCHAR(20)   NOT NULL DEFAULT 'mitigate'
                         CHECK (treatment IN ('mitigate','accept','transfer','avoid')),
  residual_likelihood  INTEGER       NOT NULL DEFAULT 3 CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact      INTEGER       NOT NULL DEFAULT 3 CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score       INTEGER       NOT NULL DEFAULT 9,
  status               VARCHAR(20)   NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_treatment','mitigated','accepted','closed')),
  mitigation_plan      TEXT,
  owner_id             UUID,
  review_date          DATE,
  next_review_date     DATE,
  created_by           UUID,
  updated_by           UUID,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_risks_status   ON {{SCHEMA}}.risks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_category ON {{SCHEMA}}.risks(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_owner    ON {{SCHEMA}}.risks(owner_id) WHERE deleted_at IS NULL;

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.vendors (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(500)  NOT NULL,
  description       TEXT,
  category          VARCHAR(100),
  website           VARCHAR(500),
  contact_name      VARCHAR(255),
  contact_email     VARCHAR(320),
  risk_level        VARCHAR(20)   NOT NULL DEFAULT 'medium'
                      CHECK (risk_level IN ('critical','high','medium','low')),
  status            VARCHAR(20)   NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','under_review','inactive','offboarded')),
  data_processed    TEXT,
  services_provided TEXT,
  owner_id          UUID,
  onboarded_at      DATE,
  offboarded_at     DATE,
  next_review_date  DATE,
  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON {{SCHEMA}}.vendors(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_risk   ON {{SCHEMA}}.vendors(risk_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_owner  ON {{SCHEMA}}.vendors(owner_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.vendor_assessments (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID         NOT NULL REFERENCES {{SCHEMA}}.vendors(id) ON DELETE CASCADE,
  name          VARCHAR(500) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','expired')),
  score         INTEGER,
  notes         TEXT,
  assessed_by   UUID,
  assessed_at   TIMESTAMPTZ,
  due_date      DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_vendor ON {{SCHEMA}}.vendor_assessments(vendor_id);
