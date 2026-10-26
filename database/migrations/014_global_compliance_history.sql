-- Metadata-only history for organisation/access/billing changes. No tokens or secrets.
CREATE TABLE IF NOT EXISTS global.global_audit_log (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_sequence BIGSERIAL UNIQUE,
 tenant_id UUID,user_id UUID,user_role TEXT,action TEXT NOT NULL,entity_type TEXT NOT NULL,
 entity_id UUID,old_value JSONB,new_value JSONB,previous_hash TEXT NOT NULL,hash_chain TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_global_history_tenant ON global.global_audit_log(tenant_id,event_sequence DESC);
CREATE OR REPLACE FUNCTION global.protect_compliance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit history is append-only'; END $$;
DROP TRIGGER IF EXISTS protect_compliance_history ON global.global_audit_log;
CREATE TRIGGER protect_compliance_history BEFORE UPDATE OR DELETE OR TRUNCATE ON global.global_audit_log
 FOR EACH STATEMENT EXECUTE FUNCTION global.protect_compliance_history();
CREATE OR REPLACE FUNCTION global.write_compliance_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b JSONB; a JSONB; bm JSONB; am JSONB; tid UUID; uid UUID; rid UUID; prior TEXT;
BEGIN
 b=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 a=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 tid=CASE WHEN TG_TABLE_NAME='tenants' THEN COALESCE(a->>'id',b->>'id')::uuid ELSE COALESCE(a->>'tenant_id',b->>'tenant_id')::uuid END;
 uid=COALESCE(NULLIF(current_setting('app.current_user_id',true),''),a->>'updated_by',CASE WHEN TG_OP='INSERT' THEN COALESCE(a->>'created_by',a->>'invited_by') ELSE NULL END)::uuid;
 rid=COALESCE(a->>'id',b->>'id')::uuid;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}') INTO bm FROM jsonb_each(b) WHERE key IN ('id','tenant_id','user_id','role','status','is_active','is_superadmin','deleted_at','revoked_at','plan_id','expires_at');
 SELECT COALESCE(jsonb_object_agg(key,value),'{}') INTO am FROM jsonb_each(a) WHERE key IN ('id','tenant_id','user_id','role','status','is_active','is_superadmin','deleted_at','revoked_at','plan_id','expires_at');
 PERFORM pg_advisory_xact_lock(hashtext('compliancecore:global-history'));
 SELECT hash_chain INTO prior FROM global.global_audit_log ORDER BY event_sequence DESC LIMIT 1;
 prior=COALESCE(prior,'');
 INSERT INTO global.global_audit_log(tenant_id,user_id,user_role,action,entity_type,entity_id,old_value,new_value,previous_hash,hash_chain)
 VALUES(tid,uid,COALESCE(NULLIF(current_setting('app.current_user_role',true),''),'system'),TG_OP,TG_TABLE_NAME,rid,bm,am,prior,encode(sha256(convert_to(prior||TG_TABLE_NAME||TG_OP||COALESCE(rid::text,'')||COALESCE(uid::text,'')||bm::text||am::text,'UTF8')),'hex'));
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION global.write_compliance_history() FROM PUBLIC;
DO $$ DECLARE name TEXT; BEGIN
 FOREACH name IN ARRAY ARRAY['tenants','tenant_memberships','team_invitations','api_keys','webhooks','subscriptions','payment_methods','recurring_consents','users'] LOOP
  IF to_regclass('global.'||name) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS global_compliance_history ON global.%I',name);
   EXECUTE format('CREATE TRIGGER global_compliance_history AFTER INSERT OR UPDATE OR DELETE ON global.%I FOR EACH ROW EXECUTE FUNCTION global.write_compliance_history()',name);
  END IF;
 END LOOP;
END $$;
