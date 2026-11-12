-- Catalogue 2026.2 for EXISTING installations (docs/PLAN_GATING_2026.md).
--
-- On a live installation the API never creates billing tables at start-up
-- (scripts/bootstrap-billing.mjs only verifies them), so the plan-gating
-- columns, tables and the 2026 catalogue are applied here instead.
-- Mirrors backend/src/modules/billing/plan-catalog-2026.ts (same values); keep the two in step.
--
-- Safe to repeat: every statement is IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Skipped on a fresh database, where the billing tables do not exist yet and
-- initBillingTables() creates all of this itself.
-- Existing customers are untouched: the earlier plans are only withdrawn from
-- NEW sales (is_public = false) and keep every module (no module list).
DO $migration$
DECLARE r record;
BEGIN
  IF to_regclass('global.subscription_plans') IS NULL OR to_regclass('global.plan_prices') IS NULL THEN
    RAISE NOTICE '017: billing tables not created yet (fresh install); initBillingTables applies the catalogue';
    RETURN;
  END IF;

  ALTER TABLE global.subscription_plans
    ADD COLUMN IF NOT EXISTS onboarding_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS modules JSONB,
    ADD COLUMN IF NOT EXISTS catalog_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS max_ai_requests_monthly INTEGER,
    ADD COLUMN IF NOT EXISTS waive_onboarding_yearly BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE global.plan_prices ADD COLUMN IF NOT EXISTS onboarding_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS global.subscription_plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES global.subscription_plans(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    changes JSONB NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON global.subscription_plan_history (plan_id, changed_at DESC);

  CREATE TABLE IF NOT EXISTS global.ai_usage (
    tenant_id UUID NOT NULL,
    month DATE NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, month));

  CREATE TABLE IF NOT EXISTS global.upgrade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES global.users(id) ON DELETE CASCADE,
    module VARCHAR(40),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS idx_upgrade_requests_tenant ON global.upgrade_requests (tenant_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS global.payment_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(200) NOT NULL UNIQUE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('refund', 'dispute', 'webhook_rejected')),
    event VARCHAR(60),
    status VARCHAR(40),
    reference VARCHAR(120),
    tenant_id UUID,
    amount NUMERIC(12, 2),
    currency CHAR(3),
    detail JSONB NOT NULL DEFAULT '{}',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS idx_payment_issues_created ON global.payment_issues (created_at DESC);

  ALTER TABLE global.tenants
    ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS footer_text VARCHAR(300),
    ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7),
    ADD COLUMN IF NOT EXISTS brand_logo TEXT,
    ADD COLUMN IF NOT EXISTS letterhead_image TEXT;

  -- The catalogue itself, once (an owner edit made later is never overwritten).
  IF NOT EXISTS (SELECT 1 FROM global.schema_migrations WHERE version = '016_plan_catalog_2026_2') THEN
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
       max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version,
       max_ai_requests_monthly, onboarding_fee, waive_onboarding_yearly)
    VALUES ('Essential', 'essential_2026', 'Start your compliance programme: the journey, controls, policies, evidence and the data protection basics', 35000, 350000, 'NGN', 3, 2, 5,
      NULL, NULL, '["3 team members","2 frameworks, 5 GB evidence storage","Compliance journey and assessments","Controls, policies and evidence","Records of processing","Data subject requests","Incident register","Tasks, calendar and expiry tracker","Basic reports and your branding","No onboarding fee"]'::jsonb, 11, true, true, '{"risks":false,"policy_templates":false,"audits":false,"approvals":false,"training":false,"incidents":true,"analytics":false,"signatures":false,"vendors":false,"escalations":false,"privacy_ropa":true,"privacy_dsar":true,"privacy_dpia":false,"msp_portfolio":false,"scheduled_reports":false,"integrations":false,"ai":false}'::jsonb, '2026.2',
      0, 0, false)
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
      SELECT id, 'NGN', 35000, 350000, 0 FROM global.subscription_plans WHERE slug = 'essential_2026'
    ON CONFLICT (plan_id, currency) DO NOTHING;
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
       max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version,
       max_ai_requests_monthly, onboarding_fee, waive_onboarding_yearly)
    VALUES ('Growth', 'growth_2026', 'Essential plus risk assessment, policy templates, approvals, training, impact assessments and enhanced reporting', 75000, 750000, 'NGN', 10, 3, 20,
      NULL, NULL, '["10 team members","3 frameworks, 20 GB evidence storage","Everything in Essential","Risk assessment","Policy templates","Approvals","Training","Impact assessments","Enhanced reporting","Onboarding waived when you pay yearly"]'::jsonb, 12, true, true, '{"risks":true,"policy_templates":true,"audits":false,"approvals":true,"training":true,"incidents":true,"analytics":true,"signatures":false,"vendors":false,"escalations":false,"privacy_ropa":true,"privacy_dsar":true,"privacy_dpia":true,"msp_portfolio":false,"scheduled_reports":false,"integrations":false,"ai":false}'::jsonb, '2026.2',
      0, 100000, true)
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
      SELECT id, 'NGN', 75000, 750000, 100000 FROM global.subscription_plans WHERE slug = 'growth_2026'
    ON CONFLICT (plan_id, currency) DO NOTHING;
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
       max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version,
       max_ai_requests_monthly, onboarding_fee, waive_onboarding_yearly)
    VALUES ('Professional', 'professional_2026', 'Growth plus audits, signatures, vendors, escalations and AI tools', 150000, 1500000, 'NGN', 25, 5, 50,
      NULL, NULL, '["25 team members","5 frameworks, 50 GB evidence storage","Everything in Growth","Audits and audit room","Signatures","Vendors","Escalations","AI tools with human review (100 requests a month)","Onboarding waived when you pay yearly"]'::jsonb, 13, true, true, '{"risks":true,"policy_templates":true,"audits":true,"approvals":true,"training":true,"incidents":true,"analytics":true,"signatures":true,"vendors":true,"escalations":true,"privacy_ropa":true,"privacy_dsar":true,"privacy_dpia":true,"msp_portfolio":false,"scheduled_reports":false,"integrations":false,"ai":true}'::jsonb, '2026.2',
      100, 250000, true)
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
      SELECT id, 'NGN', 150000, 1500000, 250000 FROM global.subscription_plans WHERE slug = 'professional_2026'
    ON CONFLICT (plan_id, currency) DO NOTHING;
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
       max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version,
       max_ai_requests_monthly, onboarding_fee, waive_onboarding_yearly)
    VALUES ('Business', 'business_2026', 'Professional plus client portfolio, scheduled reports, approved integrations and more AI', 300000, 3000000, 'NGN', 50, NULL, 150,
      NULL, NULL, '["50 team members","Unlimited frameworks, 150 GB evidence storage","Everything in Professional","Client portfolio","Scheduled (advanced) reports","Approved integrations","AI tools with human review (500 requests a month)","Onboarding waived when you pay yearly"]'::jsonb, 14, true, true, '{"risks":true,"policy_templates":true,"audits":true,"approvals":true,"training":true,"incidents":true,"analytics":true,"signatures":true,"vendors":true,"escalations":true,"privacy_ropa":true,"privacy_dsar":true,"privacy_dpia":true,"msp_portfolio":true,"scheduled_reports":true,"integrations":true,"ai":true}'::jsonb, '2026.2',
      500, 500000, true)
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
      SELECT id, 'NGN', 300000, 3000000, 500000 FROM global.subscription_plans WHERE slug = 'business_2026'
    ON CONFLICT (plan_id, currency) DO NOTHING;
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
       max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version,
       max_ai_requests_monthly, onboarding_fee, waive_onboarding_yearly)
    VALUES ('Enterprise', 'enterprise_2026', 'Custom: everything, with terms agreed in writing (annual from N6,000,000)', 600000, 6000000, 'NGN', NULL, NULL, NULL,
      NULL, NULL, '["Unlimited team members and frameworks","Every module","Custom terms, rollout and training","Annual from N6,000,000; onboarding from N1,500,000"]'::jsonb, 15, true, true, NULL, '2026.2',
      NULL, 1500000, false)
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
      SELECT id, 'NGN', 600000, 6000000, 1500000 FROM global.subscription_plans WHERE slug = 'enterprise_2026'
    ON CONFLICT (plan_id, currency) DO NOTHING;
    UPDATE global.subscription_plans SET is_public = false, updated_at = NOW()
      WHERE slug IN ('starter', 'professional', 'business', 'enterprise', 'msp');
    INSERT INTO global.schema_migrations (version, description)
      VALUES ('016_plan_catalog_2026_2', 'Catalogue 2026.2: Essential to Enterprise with module allocation; earlier plans withdrawn from new sales')
      ON CONFLICT DO NOTHING;
  END IF;

  -- The API signs in with a restricted runtime login, not the one running this
  -- migration. Give the new tables to every login that can already work with
  -- subscriptions (the runtime login), exactly as earlier releases did.
  FOR r IN
    SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema = 'global' AND table_name = 'subscriptions' AND privilege_type = 'INSERT'
      AND grantee <> current_user AND grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON global.subscription_plan_history, global.ai_usage, global.upgrade_requests, global.payment_issues TO %I', r.grantee);
  END LOOP;
END
$migration$;
