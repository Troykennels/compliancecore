-- =============================================================================
-- Migration 006 — Evidence Hub (Tenant Schema Template)
-- Applied to each tenant schema (tenant_{uuid}) by the provisioning service.
-- Replace {{SCHEMA}} with the actual schema name during provisioning.
-- =============================================================================

-- ── EVIDENCE CATEGORIES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_categories (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  color         VARCHAR(7)   NOT NULL DEFAULT '#6366F1', -- hex color
  icon          VARCHAR(50)  NOT NULL DEFAULT 'file',
  is_system     BOOLEAN      NOT NULL DEFAULT FALSE, -- system categories can't be deleted
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  created_by    UUID,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Partial unique index: category names must be unique among non-deleted rows.
-- (A table-level UNIQUE constraint cannot carry a WHERE clause in Postgres.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_categories_name
  ON {{SCHEMA}}.evidence_categories (name) WHERE deleted_at IS NULL;

-- Seed system categories
INSERT INTO {{SCHEMA}}.evidence_categories
  (name, description, color, icon, is_system, sort_order)
VALUES
  ('Policy Document',    'Formal policy documents and policy statements',               '#4F46E5', 'book-open',   TRUE, 1),
  ('Procedure',         'Standard operating procedures and work instructions',          '#7C3AED', 'list-checks', TRUE, 2),
  ('Screenshot',        'Screenshots and screen recordings as evidence',                '#0284C7', 'monitor',     TRUE, 3),
  ('Log File',          'System, application, or security log files',                   '#059669', 'terminal',    TRUE, 4),
  ('Report',            'Audit reports, assessment reports, and scan reports',          '#D97706', 'bar-chart',   TRUE, 5),
  ('Certificate',       'Security certificates, compliance certificates, badges',       '#DC2626', 'award',       TRUE, 6),
  ('Contract',          'Vendor contracts, DPAs, NDAs, and service agreements',         '#9333EA', 'file-text',   TRUE, 7),
  ('Scan / Photo',      'Physical document scans and photographs',                      '#0891B2', 'camera',      TRUE, 8),
  ('Training Record',   'Training completion records and attendance logs',              '#65A30D', 'graduation-cap', TRUE, 9),
  ('Test Result',       'Penetration test results, vulnerability scans, assessments',   '#E11D48', 'shield-check', TRUE, 10),
  ('Other',             'Evidence that does not fit another category',                  '#64748B', 'file',        TRUE, 99)
ON CONFLICT DO NOTHING;

-- ── EVIDENCE TAGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_tags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50)  NOT NULL,
  color       VARCHAR(7)   NOT NULL DEFAULT '#64748B',
  created_by  UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

-- ── EVIDENCE (main record) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(500) NOT NULL,
  description         TEXT,
  category_id         UUID         REFERENCES {{SCHEMA}}.evidence_categories(id) ON DELETE SET NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'active'  -- active | archived | expired
                        CHECK (status IN ('active', 'archived', 'expired')),
  is_confidential     BOOLEAN      NOT NULL DEFAULT FALSE,
  retention_date      TIMESTAMPTZ,                            -- when evidence expires/must be reviewed
  collected_at        TIMESTAMPTZ,                            -- date evidence was originally collected
  collected_by        UUID,                                   -- may differ from uploader
  current_version_id  UUID,                                   -- FK set after first version created
  ocr_status          VARCHAR(20)  NOT NULL DEFAULT 'pending' -- pending | processing | completed | failed | not_applicable
                        CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'not_applicable')),
  ocr_text            TEXT,                                   -- extracted text from OCR
  search_vector       TSVECTOR,                               -- auto-updated for FTS
  created_by          UUID,
  updated_by          UUID,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- Full-text search trigger: auto-updates search_vector on every insert/update
CREATE OR REPLACE FUNCTION {{SCHEMA}}.fn_update_evidence_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')),      'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.ocr_text, '')),    'C');
  RETURN NEW;
END;
$$;

-- Dropped first so re-applying this template to an EXISTING tenant succeeds.
-- Every other object here uses IF NOT EXISTS; plain CREATE TRIGGER was the one
-- statement that made the template non-idempotent, which broke back-filling a
-- new template onto tenants that already exist.
DROP TRIGGER IF EXISTS tg_evidence_search_vector ON {{SCHEMA}}.evidence;
CREATE TRIGGER tg_evidence_search_vector
  BEFORE INSERT OR UPDATE ON {{SCHEMA}}.evidence
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.fn_update_evidence_search_vector();

CREATE INDEX IF NOT EXISTS idx_evidence_search
  ON {{SCHEMA}}.evidence USING GIN(search_vector) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_category
  ON {{SCHEMA}}.evidence(category_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_status
  ON {{SCHEMA}}.evidence(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_ocr_status
  ON {{SCHEMA}}.evidence(ocr_status) WHERE deleted_at IS NULL;

-- ── EVIDENCE VERSIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_versions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id       UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence(id) ON DELETE CASCADE,
  version_number    INTEGER      NOT NULL,
  file_name         VARCHAR(500) NOT NULL,
  file_key          TEXT         NOT NULL,             -- S3 object key
  file_size_bytes   BIGINT       NOT NULL DEFAULT 0,
  mime_type         VARCHAR(100) NOT NULL,
  checksum_sha256   VARCHAR(64),                       -- provided by uploader for integrity check
  upload_status     VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (upload_status IN ('pending', 'completed', 'failed')),
  change_note       TEXT,                              -- what changed in this version
  uploaded_by       UUID,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (evidence_id, version_number)
);

-- After creating this table, add the FK from evidence to evidence_versions.
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard on the catalogue —
-- otherwise re-applying this template to an existing tenant aborts here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_evidence_current_version'
      AND conrelid = '{{SCHEMA}}.evidence'::regclass
  ) THEN
    ALTER TABLE {{SCHEMA}}.evidence
      ADD CONSTRAINT fk_evidence_current_version
      FOREIGN KEY (current_version_id)
      REFERENCES {{SCHEMA}}.evidence_versions(id) ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_versions_evidence
  ON {{SCHEMA}}.evidence_versions(evidence_id);

-- ── EVIDENCE TAGS JOIN ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_tag_links (
  evidence_id UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence(id) ON DELETE CASCADE,
  tag_id      UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence_tags(id) ON DELETE CASCADE,
  tagged_by   UUID,
  tagged_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evidence_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_tag_links_tag
  ON {{SCHEMA}}.evidence_tag_links(tag_id);

-- ── EVIDENCE LINKS (link to controls, risks, policies, audits) ──────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_links (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id   UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence(id) ON DELETE CASCADE,
  linked_type   VARCHAR(50)  NOT NULL CHECK (linked_type IN ('control', 'risk', 'policy', 'audit', 'vendor')),
  linked_id     UUID         NOT NULL,
  linked_by     UUID,
  linked_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (evidence_id, linked_type, linked_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_linked
  ON {{SCHEMA}}.evidence_links(linked_type, linked_id);

-- ── EVIDENCE SHARE LINKS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_shares (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id       UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence(id) ON DELETE CASCADE,
  share_token       VARCHAR(64)  NOT NULL UNIQUE,
  share_type        VARCHAR(20)  NOT NULL DEFAULT 'link' CHECK (share_type IN ('link', 'email')),
  recipient_email   VARCHAR(255),
  password_hash     VARCHAR(60),                    -- optional password protection (bcrypt)
  shared_by         UUID,
  expires_at        TIMESTAMPTZ,
  accessed_count    INTEGER      NOT NULL DEFAULT 0,
  last_accessed_at  TIMESTAMPTZ,
  is_revoked        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_shares_token
  ON {{SCHEMA}}.evidence_shares(share_token) WHERE is_revoked = FALSE;

CREATE INDEX IF NOT EXISTS idx_evidence_shares_evidence
  ON {{SCHEMA}}.evidence_shares(evidence_id);

-- ── EVIDENCE AUDIT EVENTS ───────────────────────────────────────────────────
-- Tracks explicit user interactions beyond the generic audit_logs trigger
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.evidence_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID         NOT NULL REFERENCES {{SCHEMA}}.evidence(id) ON DELETE CASCADE,
  event_type  VARCHAR(50)  NOT NULL, -- 'uploaded', 'viewed', 'downloaded', 'shared', 'ocr_completed',
                                      -- 'version_added', 'tagged', 'category_changed', 'archived',
                                      -- 'share_accessed', 'link_added', 'link_removed'
  actor_id    UUID,
  actor_email VARCHAR(255),
  metadata    JSONB        NOT NULL DEFAULT '{}',   -- e.g., { shareToken, versionNumber, ip }
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_events_evidence
  ON {{SCHEMA}}.evidence_events(evidence_id, created_at DESC);

