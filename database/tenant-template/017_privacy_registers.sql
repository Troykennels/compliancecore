-- Privacy registers: records of processing (GDPR Art. 30 / NDPA), data subject requests and impact assessments.
-- Additive and idempotent. Each table is covered by the compliance audit ledger.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.privacy_processing_activities (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 purpose TEXT NOT NULL,
 lawful_basis TEXT NOT NULL CHECK (lawful_basis IN ('consent','contract','legal_obligation','vital_interests','public_task','legitimate_interests')),
 data_subjects TEXT NOT NULL,
 data_categories TEXT NOT NULL,
 special_categories BOOLEAN NOT NULL DEFAULT FALSE,
 recipients TEXT,
 transfers TEXT,
 transfer_safeguard TEXT,
 retention TEXT NOT NULL,
 security_measures TEXT,
 owner_id UUID REFERENCES global.users(id),
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
 review_date DATE,
 created_by UUID REFERENCES global.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_privacy_activities_live ON {{SCHEMA}}.privacy_processing_activities(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.privacy_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 reference TEXT NOT NULL,
 requester TEXT NOT NULL,
 request_type TEXT NOT NULL CHECK (request_type IN ('access','rectification','erasure','restriction','portability','objection','other')),
 received_on DATE NOT NULL,
 due_date DATE NOT NULL,
 identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
 extension_reason TEXT,
 status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','verifying','in_progress','completed','refused')),
 outcome TEXT,
 responded_on DATE,
 owner_id UUID REFERENCES global.users(id),
 created_by UUID REFERENCES global.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_privacy_requests_reference ON {{SCHEMA}}.privacy_requests(reference);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_open ON {{SCHEMA}}.privacy_requests(due_date) WHERE deleted_at IS NULL AND status NOT IN ('completed','refused');

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.privacy_impact_assessments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title TEXT NOT NULL,
 activity_id UUID REFERENCES {{SCHEMA}}.privacy_processing_activities(id),
 description TEXT NOT NULL,
 necessity TEXT,
 risks TEXT,
 mitigations TEXT,
 residual_risk TEXT NOT NULL DEFAULT 'not_assessed' CHECK (residual_risk IN ('not_assessed','low','medium','high')),
 consultation_required BOOLEAN NOT NULL DEFAULT FALSE,
 dpo_advice TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','rejected')),
 owner_id UUID REFERENCES global.users(id),
 reviewed_by UUID REFERENCES global.users(id),
 review_date DATE,
 created_by UUID REFERENCES global.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_privacy_dpia_live ON {{SCHEMA}}.privacy_impact_assessments(status) WHERE deleted_at IS NULL;

DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['privacy_processing_activities','privacy_requests','privacy_impact_assessments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS compliance_mutation_audit ON %I.%I','{{SCHEMA}}',t);
  EXECUTE format('CREATE TRIGGER compliance_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.write_compliance_audit()','{{SCHEMA}}',t);
 END LOOP;
END $$;
