-- Additive implementation records. Existing controls/policies are preserved and
-- are never retroactively described as approved implementations.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.framework_implementations (
  framework_id UUID PRIMARY KEY REFERENCES framework_data.frameworks(id),
  scope TEXT NOT NULL,
  objective TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES global.users(id),
  target_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','in_progress','in_review','implemented')),
  submitted_by UUID REFERENCES global.users(id),
  submitted_at TIMESTAMPTZ,
  review_hash TEXT,
  approved_by UUID REFERENCES global.users(id),
  approved_at TIMESTAMPTZ,
  review_due_at TIMESTAMPTZ,
  review_note TEXT,
  preparation JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES global.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.framework_implementation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES framework_data.frameworks(id),
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES global.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_framework_implementation_events
 ON {{SCHEMA}}.framework_implementation_events(framework_id,created_at DESC);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.framework_control_applicability (
 control_id UUID PRIMARY KEY REFERENCES {{SCHEMA}}.controls(id),
 applicable BOOLEAN NOT NULL,
 justification TEXT NOT NULL CHECK(length(trim(justification))>=20),
 decided_by UUID NOT NULL REFERENCES global.users(id),
 decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
