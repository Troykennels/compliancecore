-- Additive runtime structures. Never replay the original full blueprint.
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.audit_log (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_sequence BIGSERIAL UNIQUE,
 user_id UUID, user_role VARCHAR(50), action VARCHAR(100) NOT NULL,
 entity_type VARCHAR(100), entity_id UUID, record_key TEXT, old_value JSONB, new_value JSONB,
 hash_chain VARCHAR(64) NOT NULL, previous_hash VARCHAR(64) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE {{SCHEMA}}.audit_log ADD COLUMN IF NOT EXISTS record_key TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_record ON {{SCHEMA}}.audit_log(entity_type,entity_id,event_sequence DESC);
CREATE OR REPLACE FUNCTION {{SCHEMA}}.protect_audit_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit history is append-only'; END $$;
DROP TRIGGER IF EXISTS protect_audit_history ON {{SCHEMA}}.audit_log;
CREATE TRIGGER protect_audit_history BEFORE UPDATE OR DELETE OR TRUNCATE ON {{SCHEMA}}.audit_log
 FOR EACH STATEMENT EXECUTE FUNCTION {{SCHEMA}}.protect_audit_history();

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.compliance_obligations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL,
 authority TEXT NOT NULL, source_url TEXT NOT NULL, source_version TEXT NOT NULL,
 jurisdiction TEXT NOT NULL, sector TEXT NOT NULL, verified_on DATE NOT NULL,
 applicability TEXT NOT NULL DEFAULT 'pending' CHECK(applicability IN ('pending','applicable','not_applicable')),
 rationale TEXT NOT NULL DEFAULT '', owner_id UUID NOT NULL REFERENCES global.users(id),
 due_date DATE, review_date DATE NOT NULL, evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id),
 control_ids UUID[] NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','active','superseded')),
 created_by UUID NOT NULL REFERENCES global.users(id), updated_by UUID REFERENCES global.users(id), reviewed_by UUID REFERENCES global.users(id),
 reviewed_at TIMESTAMPTZ, revision INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE {{SCHEMA}}.compliance_obligations ADD COLUMN IF NOT EXISTS effective_on DATE;
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.control_tests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), control_id UUID NOT NULL REFERENCES {{SCHEMA}}.controls(id),
 test_type VARCHAR(50) NOT NULL DEFAULT 'manual', result TEXT NOT NULL CHECK(result IN ('pass','fail','exception')),
 notes TEXT NOT NULL, test_data JSONB NOT NULL, tested_by UUID NOT NULL REFERENCES global.users(id),
 tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reviewed_by UUID REFERENCES global.users(id), reviewed_at TIMESTAMPTZ, review_note TEXT,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','returned')),
 control_snapshot JSONB NOT NULL, evidence_versions JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.compliance_obligation_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id UUID NOT NULL REFERENCES {{SCHEMA}}.compliance_obligations(id),
 revision INTEGER NOT NULL, snapshot JSONB NOT NULL, reviewed_by UUID NOT NULL REFERENCES global.users(id),
 reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(obligation_id,revision)
);
CREATE INDEX IF NOT EXISTS idx_control_test_control ON {{SCHEMA}}.control_tests(control_id,tested_at DESC);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.policy_acknowledgments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), policy_id UUID NOT NULL REFERENCES {{SCHEMA}}.policies(id),
 policy_version_id UUID NOT NULL REFERENCES {{SCHEMA}}.policy_versions(id),
 user_id UUID NOT NULL REFERENCES global.users(id), assigned_by UUID NOT NULL REFERENCES global.users(id),
 acknowledged_at TIMESTAMPTZ, due_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(policy_id,policy_version_id,user_id)
);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.risk_control_links (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), risk_id UUID NOT NULL REFERENCES {{SCHEMA}}.risks(id),
 control_id UUID NOT NULL REFERENCES {{SCHEMA}}.controls(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(risk_id,control_id)
);
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.risk_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),risk_id UUID NOT NULL REFERENCES {{SCHEMA}}.risks(id),
 reviewed_by UUID NOT NULL REFERENCES global.users(id),reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 decision TEXT NOT NULL CHECK(decision IN ('approve','return')),notes TEXT NOT NULL,
 expires_on DATE NOT NULL, risk_snapshot JSONB NOT NULL
);
-- Bridge existing worksheet links into the shared relation; do not clone risks.
INSERT INTO {{SCHEMA}}.risk_control_links(risk_id,control_id)
 SELECT r.id,c.id FROM {{SCHEMA}}.risks r CROSS JOIN LATERAL unnest(r.control_ids) linked(id)
 JOIN {{SCHEMA}}.controls c ON c.id=linked.id WHERE r.deleted_at IS NULL AND c.deleted_at IS NULL
 ON CONFLICT(risk_id,control_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS {{SCHEMA}}.vendor_questionnaire_responses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id UUID NOT NULL REFERENCES {{SCHEMA}}.vendors(id),
 questionnaire_version TEXT NOT NULL DEFAULT '1',responses JSONB NOT NULL,recorded_by UUID NOT NULL REFERENCES global.users(id),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','returned')),
 reviewed_by UUID REFERENCES global.users(id),reviewed_at TIMESTAMPTZ,review_note TEXT,review_due DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE {{SCHEMA}}.tasks ADD COLUMN IF NOT EXISTS corrective_action JSONB;
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS closure_evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id);
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS closure_evidence_version_id UUID REFERENCES {{SCHEMA}}.evidence_versions(id);
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS control_id UUID REFERENCES {{SCHEMA}}.controls(id);
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES {{SCHEMA}}.control_tests(id);
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS closure_note TEXT;
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES global.users(id);
ALTER TABLE {{SCHEMA}}.audit_findings ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE {{SCHEMA}}.audits ADD COLUMN IF NOT EXISTS report_review_note TEXT;
ALTER TABLE {{SCHEMA}}.audits ADD COLUMN IF NOT EXISTS report_evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id);
ALTER TABLE {{SCHEMA}}.audits ADD COLUMN IF NOT EXISTS report_evidence_version_id UUID REFERENCES {{SCHEMA}}.evidence_versions(id);
ALTER TABLE {{SCHEMA}}.audits ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES global.users(id);
ALTER TABLE {{SCHEMA}}.audits ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE {{SCHEMA}}.training_records ADD COLUMN IF NOT EXISTS completion_evidence_id UUID REFERENCES {{SCHEMA}}.evidence(id);
ALTER TABLE {{SCHEMA}}.training_records ADD COLUMN IF NOT EXISTS completion_evidence_version_id UUID REFERENCES {{SCHEMA}}.evidence_versions(id);
ALTER TABLE {{SCHEMA}}.training_records ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE {{SCHEMA}}.training_records ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES global.users(id);
ALTER TABLE {{SCHEMA}}.incidents ADD COLUMN IF NOT EXISTS notification_decision JSONB;
ALTER TABLE {{SCHEMA}}.compliance_calendar_events ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_source_key ON {{SCHEMA}}.compliance_calendar_events(source_key) WHERE source_key IS NOT NULL;

-- Metadata-only deltas: never copy file text, secrets, interview answers or incident details.
CREATE OR REPLACE FUNCTION {{SCHEMA}}.write_compliance_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior_hash TEXT; before_row JSONB; after_row JSONB; old_meta JSONB; new_meta JSONB; record_id UUID; actor UUID;
BEGIN
 before_row=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}') INTO old_meta FROM jsonb_each(before_row)
  WHERE right(key,3)='_id' OR key IN ('id','status','implementation_status','control_ids','owner_id','assigned_to','current_version','current_version_id','reviewed_by','approved_by','due_date','review_date','deleted_at','applicability','revision','acknowledged_at','result','rating_confirmed');
 SELECT COALESCE(jsonb_object_agg(key,value),'{}') INTO new_meta FROM jsonb_each(after_row)
  WHERE right(key,3)='_id' OR key IN ('id','status','implementation_status','control_ids','owner_id','assigned_to','current_version','current_version_id','reviewed_by','approved_by','due_date','review_date','deleted_at','applicability','revision','acknowledged_at','result','rating_confirmed');
 record_id=CASE WHEN COALESCE(after_row->>'id',before_row->>'id','')~'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' THEN COALESCE(after_row->>'id',before_row->>'id')::uuid ELSE NULL END;
 actor=NULLIF(current_setting('app.current_user_id',true),'')::uuid;
 PERFORM pg_advisory_xact_lock(hashtext('{{SCHEMA}}:audit-ledger'));
 SELECT hash_chain INTO prior_hash FROM {{SCHEMA}}.audit_log ORDER BY event_sequence DESC LIMIT 1;
 prior_hash=COALESCE(prior_hash,'');
 INSERT INTO {{SCHEMA}}.audit_log(user_id,user_role,action,entity_type,entity_id,record_key,old_value,new_value,previous_hash,hash_chain)
 VALUES(actor,COALESCE(NULLIF(current_setting('app.current_user_role',true),''),'system'),TG_OP,TG_TABLE_NAME,record_id,COALESCE(after_row->>'id',before_row->>'id'),old_meta,new_meta,prior_hash,
 encode(sha256(convert_to(prior_hash||TG_TABLE_NAME||TG_OP||COALESCE(record_id::text,'')||COALESCE(actor::text,'')||old_meta::text||new_meta::text,'UTF8')),'hex'));
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION {{SCHEMA}}.write_compliance_audit() FROM PUBLIC;
DO $$ DECLARE t RECORD; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='{{SCHEMA}}' AND tablename NOT LIKE 'audit_log%' LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS compliance_mutation_audit ON %I.%I','{{SCHEMA}}',t.tablename);
  EXECUTE format('CREATE TRIGGER compliance_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.write_compliance_audit()','{{SCHEMA}}',t.tablename);
 END LOOP;
END $$;
