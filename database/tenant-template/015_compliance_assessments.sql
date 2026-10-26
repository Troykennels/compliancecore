-- Additive compliance assessments. Existing records and approvals are retained.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.scope_engagements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 framework_id UUID NOT NULL REFERENCES framework_data.frameworks(id),
 stakeholder TEXT NOT NULL,
 department TEXT NOT NULL,
 consulted_on DATE NOT NULL,
 answers JSONB NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed')),
 recorded_by UUID NOT NULL REFERENCES global.users(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scope_engagement_framework ON {{SCHEMA}}.scope_engagements(framework_id);
ALTER TABLE {{SCHEMA}}.framework_control_applicability ADD COLUMN IF NOT EXISTS supporting_evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id);
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS framework_id UUID REFERENCES framework_data.frameworks(id);
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS asset_name TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS asset_type TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS threat TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS vulnerability TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS consequence TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS control_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS assessment_basis TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS rating_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS residual_basis TEXT;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS treatment_due_date DATE;
ALTER TABLE {{SCHEMA}}.risks ADD COLUMN IF NOT EXISTS acceptance_note TEXT;
CREATE INDEX IF NOT EXISTS idx_risks_framework ON {{SCHEMA}}.risks(framework_id) WHERE deleted_at IS NULL;
