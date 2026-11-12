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
// Five plans with naira prices (annual = 10 x monthly), user caps and the
// module allocation proposed in the prompt. DRAFT prices: every figure is an
// ordinary plan row, editable in the owner console (Billing Admin), and every
// edit is kept in global.subscription_plan_history.
//
// The earlier plans (Starter, Professional, Business, Enterprise, MSP) are
// withdrawn from NEW sales only (is_public = false). They stay active, keep no
// module list (so every module stays open) and keep their prices: customers on
// them keep their contracted entitlements (grandfathered) until migrated with
// their approval.

export const CATALOG_VERSION_2026 = '2026.2';

const ESSENTIAL: string[] = [];
const GROWTH = [...ESSENTIAL, 'risks', 'policy_templates', 'audits', 'approvals', 'training', 'incidents', 'analytics'];
const PROFESSIONAL = [...GROWTH, 'signatures', 'vendors', 'escalations', 'privacy_ropa', 'privacy_dsar', 'privacy_dpia'];
const BUSINESS = [...PROFESSIONAL, 'msp_portfolio', 'scheduled_reports', 'integrations', 'ai'];

export const PLANS_2026 = [
  { slug: 'essential_2026', name: 'Essential', monthly: 12000, users: 3, ai: 0, modules: ESSENTIAL, order: 11,
    description: 'Basic compliance journey, assessments, controls, policies, evidence, tasks, calendar, expiry tracker and basic reports',
    features: ['3 team members', 'Compliance journey and assessments', 'Controls, policies and evidence', 'Tasks, calendar and expiry tracker', 'Basic reports', 'Your branding on documents'] },
  { slug: 'growth_2026', name: 'Growth', monthly: 25000, users: 10, ai: 0, modules: GROWTH, order: 12,
    description: 'Essential plus risk assessment, policy templates, audits, approvals, training, incidents and enhanced reporting',
    features: ['10 team members', 'Everything in Essential', 'Risk assessment', 'Policy templates', 'Audits and approvals', 'Training', 'Incident register', 'Enhanced reporting'] },
  { slug: 'professional_2026', name: 'Professional', monthly: 50000, users: 25, ai: 0, modules: PROFESSIONAL, order: 13,
    description: 'Growth plus signatures, vendors, escalations, records of processing, data subject requests and impact assessments',
    features: ['25 team members', 'Everything in Growth', 'Signatures', 'Vendors', 'Escalations', 'Records of processing', 'Data subject requests', 'Impact assessments'] },
  { slug: 'business_2026', name: 'Business', monthly: 90000, users: 50, ai: 300, modules: BUSINESS, order: 14,
    description: 'Professional plus client portfolio, advanced reporting, approved integrations and governed AI tools',
    features: ['50 team members', 'Everything in Professional', 'Client portfolio', 'Scheduled (advanced) reports', 'Approved integrations', 'AI tools with human review (300 requests a month)'] },
  // Contact sales. Priced above zero on purpose: a zero-priced plan is treated
  // as free, which would let anyone assign themselves Enterprise.
  { slug: 'enterprise_2026', name: 'Enterprise', monthly: 150000, yearly: 1800000, users: null, ai: null, modules: null, order: 15,
    description: 'Custom: everything, with terms agreed in writing (annual from N1,800,000)',
    features: ['Unlimited team members', 'Every module', 'Custom terms and onboarding', 'Annual from N1,800,000'] },
] as const;

export const OLD_PLAN_SLUGS = ['starter', 'professional', 'business', 'enterprise', 'msp'];

export async function initPlanCatalog2026(): Promise<void> {
  // Columns and the history table are idempotent and run on every boot.
  await prisma.$executeRawUnsafe(`ALTER TABLE global.subscription_plans
    ADD COLUMN IF NOT EXISTS modules JSONB,
    ADD COLUMN IF NOT EXISTS catalog_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS max_ai_requests_monthly INTEGER`);
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
           max_branches, max_departments, features, sort_order, is_active, is_public, modules, catalog_version, max_ai_requests_monthly)
        VALUES ($1, $2, $3, $4, $5, 'NGN', $6, NULL, NULL, NULL, NULL, $7::jsonb, $8, true, true, $9::jsonb, $10, $11)
        ON CONFLICT (slug) DO NOTHING`,
        p.name, p.slug, p.description, p.monthly, yearly, p.users, JSON.stringify(p.features), p.order,
        p.modules ? JSON.stringify(modulesFor(p.modules)) : null, CATALOG_VERSION_2026, p.ai);
      await tx.$executeRawUnsafe(`INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
        SELECT id, 'NGN', $2, $3 FROM global.subscription_plans WHERE slug = $1
        ON CONFLICT (plan_id, currency) DO NOTHING`, p.slug, p.monthly, yearly);
    }
    // Withdrawn from new sales only; customers on them are untouched.
    await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET is_public = false, updated_at = NOW()
      WHERE slug = ANY($1::text[])`, OLD_PLAN_SLUGS);
    logger.info('Plan catalogue 2026.2 applied (earlier plans withdrawn from new sales)');
  });
}
