-- Retain the actual assessment outcome and its independently reviewed proof.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.assessment_outcomes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 framework_id UUID NOT NULL UNIQUE REFERENCES framework_data.frameworks(id),
 kind TEXT NOT NULL CHECK(kind IN ('recorded','not_sought')),
 authority TEXT NOT NULL,
 reference TEXT NOT NULL,
 note TEXT NOT NULL,
 issued_on DATE NOT NULL,
 next_review_on DATE NOT NULL,
 valid_until DATE,
 evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id),
 evidence_version_id UUID REFERENCES {{SCHEMA}}.evidence_versions(id),
 assessment_hash TEXT NOT NULL,
 recorded_by UUID NOT NULL REFERENCES global.users(id),
 reviewed_by UUID REFERENCES global.users(id),
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(next_review_on >= issued_on),
 CHECK(valid_until IS NULL OR valid_until >= issued_on),
 CHECK(kind='not_sought' OR (evidence_id IS NOT NULL AND evidence_version_id IS NOT NULL)),
 CHECK(reviewed_by IS NULL OR reviewed_by <> recorded_by)
);
DROP TRIGGER IF EXISTS compliance_mutation_audit ON {{SCHEMA}}.assessment_outcomes;
CREATE TRIGGER compliance_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON {{SCHEMA}}.assessment_outcomes
 FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.write_compliance_audit();
