import { prisma } from '../../config/database';
import { auditCurrentActor } from '../../lib/audit-context';
import { modulesFor } from '../../lib/plan-modules';
import { logger } from '../../lib/logger';
import { initAiUsageTable } from '../../lib/ai-usage';
import { initUpgradeRequests } from './upgrade-request';
import { initPaymentIssues } from '../payments/payment-issues';
import { initBrandingColumns } from '../../lib/branding';

// ─── Catalogue 2026.2 (ComplianceCore gating prompt, section 3) ─────────────
//
// Five plans with naira prices (annual = 10 x monthly), user, framework and
// storage caps, a one-time onboarding fee and the module allocation. Every
// figure is an ordinary plan row, editable in the owner console (Billing
// Admin), and every edit is kept in global.subscription_plan_history.
//
// Pricing basis (research, 12 November 2026): foreign compliance tools start
// at about $7,500-$15,000 a year for one framework (Vanta, Drata, Secureframe,
// Sprinto) and privacy suites at about $44,000 a year (OneTrust); the Nigerian
// NDPA tool Asiri lists N900,000-N6,000,000 a year and outsourced DPO services
// start at about N600,000 a month. These plans sit below Asiri for more
// features. The allocation puts the Nigeria Data Protection Act basics
// (records of processing, data subject requests, incident register for the
// 72-hour breach notice) in every plan; the upgrade levers are team size,
// frameworks, storage, impact assessments, audits, vendors and AI.
//
// Onboarding is a one-time setup fee charged with the first payment. It is
// WAIVED when the customer pays a year upfront (waive_onboarding_yearly), to
// favour annual billing; Essential has none, so anyone can start.
//
// The earlier plans (Starter, Professional, Business, Enterprise, MSP) are
// withdrawn from NEW sales only (is_public = false). They stay active, keep no
// module list (so every module stays open) and keep their prices: customers on
// them keep their contracted entitlements (grandfathered) until migrated with
// their approval.

export const CATALOG_VERSION_2026 = '2026.2';

const ESSENTIAL = ['privacy_ropa', 'privacy_dsar', 'incidents'];
const GROWTH = [...ESSENTIAL, 'risks', 'policy_templates', 'approvals', 'training', 'analytics', 'privacy_dpia'];
const PROFESSIONAL = [...GROWTH, 'audits', 'signatures', 'vendors', 'escalations', 'ai'];
const BUSINESS = [...PROFESSIONAL, 'msp_portfolio', 'scheduled_reports', 'integrations'];

export const PLANS_2026 = [
  { slug: 'essential_2026', name: 'Essential', monthly: 35000, onboarding: 0, waiveYearly: false, users: 3, frameworks: 2, storageGb: 5, ai: 0, modules: ESSENTIAL, order: 11,
    description: 'Start your compliance programme: the journey, controls, policies, evidence and the data protection basics',
    features: ['3 team members', '2 frameworks, 5 GB evidence storage', 'Compliance journey and assessments', 'Controls, policies and evidence', 'Records of processing', 'Data subject requests', 'Incident register', 'Tasks, calendar and expiry tracker', 'Basic reports and your branding', 'No onboarding fee'] },
  { slug: 'growth_2026', name: 'Growth', monthly: 75000, onboarding: 100000, waiveYearly: true, users: 10, frameworks: 3, storageGb: 20, ai: 0, modules: GROWTH, order: 12,
    description: 'Essential plus risk assessment, policy templates, approvals, training, impact assessments and enhanced reporting',
    features: ['10 team members', '3 frameworks, 20 GB evidence storage', 'Everything in Essential', 'Risk assessment', 'Policy templates', 'Approvals', 'Training', 'Impact assessments', 'Enhanced reporting', 'Onboarding waived when you pay yearly'] },
  { slug: 'professional_2026', name: 'Professional', monthly: 150000, onboarding: 250000, waiveYearly: true, users: 25, frameworks: 5, storageGb: 50, ai: 100, modules: PROFESSIONAL, order: 13,
    description: 'Growth plus audits, signatures, vendors, escalations and AI tools',
    features: ['25 team members', '5 frameworks, 50 GB evidence storage', 'Everything in Growth', 'Audits and audit room', 'Signatures', 'Vendors', 'Escalations', 'AI tools with human review (100 requests a month)', 'Onboarding waived when you pay yearly'] },
  { slug: 'business_2026', name: 'Business', monthly: 300000, onboarding: 500000, waiveYearly: true, users: 50, frameworks: null, storageGb: 150, ai: 500, modules: BUSINESS, order: 14,
    description: 'Professional plus client portfolio, scheduled reports, approved integrations and more AI',
    features: ['50 team members', 'Unlimited frameworks, 150 GB evidence storage', 'Everything in Professional', 'Client portfolio', 'Scheduled (advanced) reports', 'Approved integrations', 'AI tools with human review (500 requests a month)', 'Onboarding waived when you pay yearly'] },
  // Contact sales. Priced above zero on purpose: a zero-priced plan is treated
  // as free, which would let anyone assign themselves Enterprise.
  { slug: 'enterprise_2026', name: 'Enterprise', monthly: 600000, yearly: 6000000, onboarding: 1500000, waiveYearly: false, users: null, frameworks: null, storageGb: null, ai: null, modules: null, order: 15,
    description: 'Custom: everything, with terms agreed in writing (annual from N6,000,000)',
    features: ['Unlimited team members and frameworks', 'Every module', 'Custom terms, rollout and training', 'Annual from N6,000,000; onboarding from N1,500,000'] },
] as const;

export const OLD_PLAN_SLUGS = ['starter', 'professional', 'business', 'enterprise', 'msp'];

export async function initPlanCatalog2026(): Promise<void> {
  // Columns and the history table are idempotent and run on every boot.
  await prisma.$executeRawUnsafe(`ALTER TABLE global.subscription_plans
    ADD COLUMN IF NOT EXISTS modules JSONB,
    ADD COLUMN IF NOT EXISTS catalog_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS max_ai_requests_monthly INTEGER,
    ADD COLUMN IF NOT EXISTS waive_onboarding_yearly BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.subscription_plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES global.subscription_plans(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    changes JSONB NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await initAiUsageTable();
  await initUpgradeRequests();
  await initPaymentIssues();
  await initBrandingColumns();
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON global.subscription_plan_history (plan_id, changed_at DESC)`);

  await prisma.$transaction(async (tx) => {
    await auditCurrentActor(tx);
    const claimed = await tx.$executeRawUnsafe(`INSERT INTO global.schema_migrations(version, description)
      VALUES('016_plan_catalog_2026_2', 'Catalogue 2026.2: Essential to Enterprise with module allocation; earlier plans withdrawn from new sales')
      ON CONFLICT DO NOTHING`);
    if (!claimed) return;
    for (const p of PLANS_2026) {
      const yearly = 'yearly' in p ? p.yearly : p.monthly * 10;
      // ON CONFLICT DO NOTHING: an existing row (edited by the owner) is kept.
      await tx.$executeRawUnsafe(`INSERT INTO global.subscription_plans
          (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb,
           max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version, max_ai_requests_monthly,
           onboarding_fee, waive_onboarding_yearly)
        VALUES ($1, $2, $3, $4, $5, 'NGN', $6, $12, $13, NULL, NULL, $7::jsonb, $8, true, true, $9::jsonb, $10, $11, $14, $15)
        ON CONFLICT (slug) DO NOTHING`,
        p.name, p.slug, p.description, p.monthly, yearly, p.users, JSON.stringify(p.features), p.order,
        p.modules ? JSON.stringify(modulesFor(p.modules)) : null, CATALOG_VERSION_2026, p.ai,
        p.frameworks, p.storageGb, p.onboarding, p.waiveYearly);
      await tx.$executeRawUnsafe(`INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly, onboarding_fee)
        SELECT id, 'NGN', $2, $3, $4 FROM global.subscription_plans WHERE slug = $1
        ON CONFLICT (plan_id, currency) DO NOTHING`, p.slug, p.monthly, yearly, p.onboarding);
    }
    // Withdrawn from new sales only; customers on them are untouched.
    await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET is_public = false, updated_at = NOW()
      WHERE slug = ANY($1::text[])`, OLD_PLAN_SLUGS);
    logger.info('Plan catalogue 2026.2 applied (earlier plans withdrawn from new sales)');
  });
}
