-- Audit room: auditors added to an audit for a dated window, evidence requests with their own states,
-- the exact evidence versions attached to each request, and comments. Additive, idempotent, audited.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_participants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 audit_id UUID NOT NULL REFERENCES {{SCHEMA}}.audits(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES global.users(id),
 access_from DATE NOT NULL,
 access_until DATE NOT NULL,
 added_by UUID REFERENCES global.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (access_until >= access_from),
 UNIQUE (audit_id, user_id)
);

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 audit_id UUID NOT NULL REFERENCES {{SCHEMA}}.audits(id) ON DELETE CASCADE,
 reference TEXT NOT NULL,
 title TEXT NOT NULL,
 requirement TEXT,
 control_id UUID REFERENCES {{SCHEMA}}.controls(id),
 description TEXT,
 owner_id UUID REFERENCES global.users(id),
 due_date DATE,
 status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','submitted','accepted','needs_revision')),
 submitted_by UUID REFERENCES global.users(id),
 submitted_at TIMESTAMPTZ,
 decided_by UUID REFERENCES global.users(id),
 decided_at TIMESTAMPTZ,
 decision_note TEXT,
 created_by UUID REFERENCES global.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deleted_at TIMESTAMPTZ,
 UNIQUE (audit_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_audit_requests_audit ON {{SCHEMA}}.audit_requests(audit_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_request_evidence (
 request_id UUID NOT NULL REFERENCES {{SCHEMA}}.audit_requests(id) ON DELETE CASCADE,
 evidence_id UUID NOT NULL REFERENCES {{SCHEMA}}.evidence(id),
 evidence_version_id UUID NOT NULL REFERENCES {{SCHEMA}}.evidence_versions(id),
 linked_by UUID REFERENCES global.users(id),
 linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 id UUID NOT NULL DEFAULT gen_random_uuid(),
 PRIMARY KEY (request_id, evidence_version_id)
);

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_request_comments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID NOT NULL REFERENCES {{SCHEMA}}.audit_requests(id) ON DELETE CASCADE,
 author_id UUID NOT NULL REFERENCES global.users(id),
 body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_request_comments ON {{SCHEMA}}.audit_request_comments(request_id);

DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['audit_participants','audit_requests','audit_request_evidence','audit_request_comments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS compliance_mutation_audit ON %I.%I','{{SCHEMA}}',t);
  EXECUTE format('CREATE TRIGGER compliance_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.write_compliance_audit()','{{SCHEMA}}',t);
 END LOOP;
END $$;
