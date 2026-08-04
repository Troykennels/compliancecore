import { prisma } from '../../config/database';
import { logger } from '../../lib/logger';
import { AppError } from '../../lib/errors';
import type {
  SubscriptionPlan, CreatePlanDto, UpdatePlanDto,
  Coupon, CreateCouponDto, UpdateCouponDto,
  Subscription, CreateSubscriptionDto,
  PaymentMethod, AddPaymentMethodDto,
  Invoice, CreateInvoiceDto, UpdateInvoiceDto, InvoiceListFilter,
  UsageRecord, UsageMetric,
  TenantBillingRow, PlanListFilter,
} from './billing.types';

// ── Table Initialisation ───────────────────────────────────────────────────────
let _initialized = false;

export async function initBillingTables(): Promise<void> {
  if (_initialized) return;

  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS global.invoice_number_seq START 1000`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
      price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      max_users INTEGER,
      max_frameworks INTEGER,
      max_evidence_gb NUMERIC(10,2),
      max_branches INTEGER,
      max_departments INTEGER,
      features JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_public BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.coupons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
      discount_value NUMERIC(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      max_uses INTEGER,
      uses_count INTEGER NOT NULL DEFAULT 0,
      min_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      applicable_plan_slugs TEXT[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      plan_id UUID NOT NULL REFERENCES global.subscription_plans(id),
      status VARCHAR(20) NOT NULL DEFAULT 'trial',
      billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly',
      current_period_start TIMESTAMPTZ NOT NULL,
      current_period_end TIMESTAMPTZ NOT NULL,
      trial_ends_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
      coupon_id UUID REFERENCES global.coupons(id),
      discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      discount_fixed NUMERIC(10,2) NOT NULL DEFAULT 0,
      next_invoice_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.payment_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'card',
      label VARCHAR(100) NOT NULL,
      last4 VARCHAR(4),
      brand VARCHAR(30),
      exp_month INTEGER,
      exp_year INTEGER,
      bank_name VARCHAR(100),
      bank_account_last4 VARCHAR(4),
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Reusable provider token, so a subscription can actually be charged again.
  // Added as ALTER rather than folded into the CREATE above because every
  // existing deployment already has this table.
  //
  // The authorization code is a bearer credential for charging that card, but
  // it is worthless without our Paystack secret key, and it must be readable to
  // be usable — so it is stored as-is rather than encrypted, and protected by
  // the same controls as the rest of the billing schema.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE global.payment_methods
      ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'paystack',
      ADD COLUMN IF NOT EXISTS authorization_code VARCHAR(120),
      ADD COLUMN IF NOT EXISTS authorization_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_reusable BOOLEAN NOT NULL DEFAULT false
  `);
  // One row per stored card per tenant, so re-paying with the same card updates
  // the token instead of accumulating duplicates on every renewal.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_methods_tenant_auth
      ON global.payment_methods (tenant_id, authorization_code)
      WHERE authorization_code IS NOT NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      subscription_id UUID,
      number VARCHAR(30) NOT NULL UNIQUE DEFAULT 'CC-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('global.invoice_number_seq')::TEXT, 6, '0'),
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      billing_period_start TIMESTAMPTZ NOT NULL,
      billing_period_end TIMESTAMPTZ NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ,
      line_items JSONB NOT NULL DEFAULT '[]',
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.usage_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      metric VARCHAR(30) NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      current_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      limit_value NUMERIC(10,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, metric, period_start)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.coupon_redemptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coupon_id UUID NOT NULL REFERENCES global.coupons(id),
      tenant_id UUID NOT NULL,
      subscription_id UUID,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed default plans.
  //
  // Prices here must match applyPricingCorrection() below, which brings a
  // database that predates naira pricing up to the same figures. This branch
  // only ever runs on a fresh install — ON CONFLICT DO NOTHING means an
  // existing row is never overwritten, so an owner's edits in the console
  // survive a reboot.
  //
  // Annual is 10x monthly across the self-service tiers: two months free.
  //
  // Enterprise and MSP are shown as "Contact Sales" in the UI. Their prices stay
  // above zero on purpose — createSubscription and updateSubscription treat a
  // zero-priced plan as free, so zeroing them would let anyone assign themselves
  // Enterprise without paying.
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks, max_evidence_gb, max_branches, max_departments, features, sort_order)
    VALUES
      ('Starter', 'starter', 'For small teams putting their first framework in place', 25000, 250000, 'NGN', 5, 3, 5, 1, 5,
       '["5 team members","3 compliance frameworks","5 GB evidence storage","Compliance dashboard","Compliance calendar","Tasks","Expiry tracker","Basic audit trail","Email notifications"]', 1),
      ('Professional', 'professional', 'For growing organisations with serious compliance needs', 85000, 850000, 'NGN', 25, 10, 50, 5, 20,
       '["25 team members","10 compliance frameworks","50 GB evidence storage","Everything in Starter","Risk register","Vendor management","Evidence hub","Incident management","AI assistant","Scheduled reports","Approval workflows","Digital signatures","Executive dashboard","Analytics"]', 2),
      ('Business', 'business', 'For established organisations running several frameworks across multiple locations', 180000, 1800000, 'NGN', 100, NULL, 250, NULL, NULL,
       '["100 team members","Unlimited compliance frameworks","250 GB evidence storage","Everything in Professional","Departments","Branches","Multi-location support","Advanced analytics","API access","Priority support","Executive reporting","AI assistant","Vendor portal","Risk management","Workflow automation"]', 3),
      ('Enterprise', 'enterprise', 'Unlimited compliance management for large organisations', 480000, 4800000, 'NGN', NULL, NULL, NULL, NULL, NULL,
       '["Unlimited users","Unlimited compliance frameworks","Unlimited evidence storage","Everything in Business","Single sign-on (SSO)","SCIM user provisioning","Dedicated support","Full API access","White-label branding","Dedicated customer success manager","Custom deployment"]', 4),
      ('MSP', 'msp', 'Managed service provider plan for multi-client management', 800000, 8000000, 'NGN', NULL, NULL, NULL, NULL, NULL,
       '["Unlimited client organisations","White-label client portal","Multi-client dashboard","Bulk client onboarding","Tenant management","Client billing","Client reporting","Everything in Enterprise"]', 5)
    ON CONFLICT (slug) DO NOTHING
  `);

  // ── Multi-currency plan pricing ──────────────────────────────────────────
  // Lives here, not in a SQL migration, because it has a foreign key to
  // subscription_plans — which is created above rather than by the migration
  // runner. Migrations all run before the app boots, so on a fresh database a
  // migration referencing this table fails with "relation does not exist".
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.plan_prices (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id       UUID NOT NULL REFERENCES global.subscription_plans(id) ON DELETE CASCADE,
      currency      CHAR(3) NOT NULL,
      price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
      price_yearly  NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT plan_prices_currency_upper CHECK (currency = UPPER(currency)),
      CONSTRAINT plan_prices_non_negative   CHECK (price_monthly >= 0 AND price_yearly >= 0),
      CONSTRAINT plan_prices_plan_currency  UNIQUE (plan_id, currency)
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON global.plan_prices (plan_id)`,
  );

  // Every plan keeps its existing price under its existing currency.
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
    SELECT id, UPPER(COALESCE(currency, 'USD')), COALESCE(price_monthly, 0), COALESCE(price_yearly, 0)
    FROM global.subscription_plans
    ON CONFLICT (plan_id, currency) DO NOTHING
  `);

  // PLACEHOLDER NGN pricing at 1 USD = 1600 NGN, rounded to the nearest ₦100,
  // so Paystack checkout has something to charge against out of the box. This
  // is not a pricing decision — set real values in the owner console. ON
  // CONFLICT DO NOTHING means edited prices are never overwritten on reboot.
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
    SELECT id, 'NGN',
           ROUND(COALESCE(price_monthly, 0) * 1600 / 100) * 100,
           ROUND(COALESCE(price_yearly,  0) * 1600 / 100) * 100
    FROM global.subscription_plans
    WHERE UPPER(COALESCE(currency, 'USD')) <> 'NGN'
    ON CONFLICT (plan_id, currency) DO NOTHING
  `);

  // ── Payment transactions ─────────────────────────────────────────────────
  // Same reasoning: foreign keys to subscription_plans and tenants.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global.payment_transactions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reference      VARCHAR(100) NOT NULL UNIQUE,
      tenant_id      UUID NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
      user_id        UUID REFERENCES global.users(id) ON DELETE SET NULL,
      plan_id        UUID NOT NULL REFERENCES global.subscription_plans(id),
      billing_cycle  VARCHAR(20) NOT NULL,
      currency       CHAR(3) NOT NULL,
      amount         NUMERIC(12, 2) NOT NULL,
      provider       VARCHAR(20) NOT NULL DEFAULT 'paystack',
      status         VARCHAR(20) NOT NULL DEFAULT 'pending',
      processed_at   TIMESTAMPTZ,
      paid_at        TIMESTAMPTZ,
      provider_ref   VARCHAR(120),
      failure_reason TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT payment_tx_currency_upper      CHECK (currency = UPPER(currency)),
      CONSTRAINT payment_tx_amount_non_negative CHECK (amount >= 0),
      CONSTRAINT payment_tx_cycle               CHECK (billing_cycle IN ('monthly', 'yearly')),
      CONSTRAINT payment_tx_status              CHECK (status IN ('pending', 'success', 'failed', 'abandoned'))
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant ON global.payment_transactions (tenant_id, created_at DESC)`,
  );

  await applyPricingCorrection();

  _initialized = true;
  logger.info('Billing tables initialised');
}

/**
 * One-time pricing and plan-allocation correction.
 *
 * The seed above only fires on a fresh database — it uses ON CONFLICT DO
 * NOTHING so it can never stamp on prices an owner has edited in the console.
 * That is the right behaviour, but it also means it can never *correct* a
 * database that was created before the naira pricing existed and is still
 * sitting on the placeholder USD figures.
 *
 * This used to be migrations 010 and 011. It cannot be: those run before the
 * app boots, and global.subscription_plans is created here, at boot — so on any
 * clean database they failed with "relation does not exist" and took CI (and
 * therefore the deploy) down with them.
 *
 * Guarded by a row in global.schema_migrations, the same table the migration
 * runner uses, so it applies exactly once per database and is skipped on every
 * subsequent boot.
 */
async function applyPricingCorrection(): Promise<void> {
  // The insert is the lock: if it affects no rows, another boot (or an earlier
  // deploy) has already done this work.
  const claimed = await prisma.$executeRawUnsafe(`
    INSERT INTO global.schema_migrations (version, description)
    VALUES ('010b_pricing_and_plan_allocation',
            'Naira pricing, Business tier and plan allowances (applied at boot)')
    ON CONFLICT (version) DO NOTHING
  `);
  if (claimed === 0) return;

  logger.info('Applying one-time pricing and plan allocation correction');

  // ── Business tier ─────────────────────────────────────────────────────────
  // Sits between Professional and Enterprise.
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.subscription_plans
        (name, slug, description, price_monthly, price_yearly, currency,
         max_users, max_frameworks, max_evidence_gb, max_branches, max_departments,
         features, sort_order, is_active, is_public)
    SELECT
        'Business', 'business',
        'For established organisations running several frameworks across multiple locations',
        180000, 1800000, 'NGN',
        100, NULL, 250, NULL, NULL,
        '["100 team members","Unlimited compliance frameworks","250 GB evidence storage","Everything in Professional","Departments","Branches","Multi-location support","Advanced analytics","API access","Priority support","Executive reporting","AI assistant","Vendor portal","Risk management","Workflow automation"]'::jsonb,
        3, TRUE, TRUE
    WHERE NOT EXISTS (SELECT 1 FROM global.subscription_plans WHERE slug = 'business')
  `);

  // ── Naira prices for the self-service tiers ───────────────────────────────
  // Scoped to plans NOT already in naira, so a price the owner has since edited
  // in the pricing console is never overwritten. Annual is 10x monthly: two
  // months free.
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET price_monthly = v.monthly,
           price_yearly  = v.yearly,
           currency      = 'NGN',
           sort_order    = v.sort_order,
           updated_at    = NOW()
      FROM (VALUES
            ('starter',       25000::numeric,   250000::numeric, 1),
            ('professional',  85000::numeric,   850000::numeric, 2),
            ('business',     180000::numeric,  1800000::numeric, 3)
           ) AS v(slug, monthly, yearly, sort_order)
     WHERE global.subscription_plans.slug = v.slug
       AND UPPER(COALESCE(global.subscription_plans.currency, 'USD')) <> 'NGN'
  `);

  // Enterprise and MSP are shown as "Contact Sales" but must stay priced.
  //
  // Two rules, both about safety rather than commerce:
  //
  //  1. The price must stay ABOVE ZERO. createSubscription/updateSubscription
  //     treat a zero-priced plan as free, so zeroing these would let anyone
  //     assign themselves Enterprise without paying.
  //
  //  2. The currency must match the other plans. The upgrade guard compares
  //     target price against current price numerically; leaving these in USD
  //     while the self-service tiers moved to naira made "299" look cheaper
  //     than "85,000", so Enterprise read as a downgrade and was granted free.
  //     billing.service.ts now also refuses to compare across currencies, but
  //     the data should not set that trap in the first place.
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans p
       SET currency      = 'NGN',
           price_monthly = COALESCE(pp.price_monthly, p.price_monthly * 1600),
           price_yearly  = COALESCE(pp.price_yearly,  p.price_yearly  * 1600),
           sort_order    = CASE p.slug WHEN 'enterprise' THEN 4 WHEN 'msp' THEN 5 END,
           updated_at    = NOW()
      FROM (SELECT plan_id, price_monthly, price_yearly
              FROM global.plan_prices WHERE currency = 'NGN') pp
     WHERE p.slug IN ('enterprise', 'msp')
       AND pp.plan_id = p.id
       AND UPPER(COALESCE(p.currency, 'USD')) <> 'NGN'
  `);

  // ── plan_prices (what checkout actually charges) ──────────────────────────
  // Checkout reads this table, not the columns above, so the two must agree or
  // a customer is charged something different from the price they were shown.
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
    SELECT p.id, 'NGN', v.monthly, v.yearly
      FROM global.subscription_plans p
      JOIN (VALUES
            ('starter',       25000::numeric,   250000::numeric),
            ('professional',  85000::numeric,   850000::numeric),
            ('business',     180000::numeric,  1800000::numeric)
           ) AS v(slug, monthly, yearly) ON v.slug = p.slug
    ON CONFLICT (plan_id, currency) DO NOTHING
  `);

  // Retire the placeholder USD rows for the self-service tiers. Selling in USD
  // requires Paystack to enable it per merchant; until then an active USD price
  // only offers a customer a checkout that fails at the provider. Deactivated
  // rather than deleted so the figures are recoverable when USD is switched on.
  await prisma.$executeRawUnsafe(`
    UPDATE global.plan_prices
       SET is_active  = FALSE,
           updated_at = NOW()
     WHERE currency = 'USD'
       AND plan_id IN (SELECT id FROM global.subscription_plans
                        WHERE slug IN ('starter', 'professional', 'business'))
  `);

  // ── Plan allowances and advertised features ───────────────────────────────
  // Every limit here is the same or HIGHER than what it replaces, so no
  // existing customer can be pushed over a cap by this change:
  //
  //   Starter        3 ->   5 users,  2 ->  3 frameworks,   1 ->   5 GB
  //   Professional  15 ->  25 users,  5 -> 10 frameworks,  10 ->  50 GB
  //   Business      50 -> 100 users,  unlimited frameworks, 50 -> 250 GB
  //   Enterprise / MSP        unlimited, unchanged
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET max_users       = 5,
           max_frameworks  = 3,
           max_evidence_gb = 5,
           features = '["5 team members","3 compliance frameworks","5 GB evidence storage","Compliance dashboard","Compliance calendar","Tasks","Expiry tracker","Basic audit trail","Email notifications"]'::jsonb,
           updated_at = NOW()
     WHERE slug = 'starter'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET max_users       = 25,
           max_frameworks  = 10,
           max_evidence_gb = 50,
           features = '["25 team members","10 compliance frameworks","50 GB evidence storage","Everything in Starter","Risk register","Vendor management","Evidence hub","Incident management","AI assistant","Scheduled reports","Approval workflows","Digital signatures","Executive dashboard","Analytics"]'::jsonb,
           updated_at = NOW()
     WHERE slug = 'professional'
  `);

  // Business advertises multi-location, so branches and departments become
  // unlimited to match. Advertising a capability and then capping it at fifteen
  // is the kind of mismatch a customer only discovers after paying.
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET max_users        = 100,
           max_frameworks   = NULL,
           max_evidence_gb  = 250,
           max_branches     = NULL,
           max_departments  = NULL,
           features = '["100 team members","Unlimited compliance frameworks","250 GB evidence storage","Everything in Professional","Departments","Branches","Multi-location support","Advanced analytics","API access","Priority support","Executive reporting","AI assistant","Vendor portal","Risk management","Workflow automation"]'::jsonb,
           updated_at = NOW()
     WHERE slug = 'business'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET max_users       = NULL,
           max_frameworks  = NULL,
           max_evidence_gb = NULL,
           max_branches    = NULL,
           max_departments = NULL,
           features = '["Unlimited users","Unlimited compliance frameworks","Unlimited evidence storage","Everything in Business","Single sign-on (SSO)","SCIM user provisioning","Dedicated support","Full API access","White-label branding","Dedicated customer success manager","Custom deployment"]'::jsonb,
           updated_at = NOW()
     WHERE slug = 'enterprise'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE global.subscription_plans
       SET max_users       = NULL,
           max_frameworks  = NULL,
           max_evidence_gb = NULL,
           max_branches    = NULL,
           max_departments = NULL,
           features = '["Unlimited client organisations","White-label client portal","Multi-client dashboard","Bulk client onboarding","Tenant management","Client billing","Client reporting","Everything in Enterprise"]'::jsonb,
           updated_at = NOW()
     WHERE slug = 'msp'
  `);
}

// ── Row-to-domain mappers ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlan(r: any): SubscriptionPlan {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? '',
    priceMonthly: Number(r.price_monthly),
    priceYearly: Number(r.price_yearly),
    currency: r.currency,
    maxUsers: r.max_users ?? null,
    maxFrameworks: r.max_frameworks ?? null,
    maxEvidenceGb: r.max_evidence_gb != null ? Number(r.max_evidence_gb) : null,
    maxBranches: r.max_branches ?? null,
    maxDepartments: r.max_departments ?? null,
    features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features ?? []),
    isActive: r.is_active,
    isPublic: r.is_public,
    sortOrder: Number(r.sort_order),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoupon(r: any): Coupon {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    currency: r.currency,
    maxUses: r.max_uses ?? null,
    usesCount: Number(r.uses_count),
    minAmount: Number(r.min_amount),
    applicablePlanSlugs: r.applicable_plan_slugs ?? [],
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    isActive: r.is_active,
    createdBy: r.created_by ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubscription(r: any): Subscription {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    planId: r.plan_id,
    planName: r.plan_name ?? '',
    planSlug: r.plan_slug ?? 'starter',
    status: r.status,
    billingCycle: r.billing_cycle,
    currentPeriodStart: String(r.current_period_start),
    currentPeriodEnd: String(r.current_period_end),
    trialEndsAt: r.trial_ends_at ? String(r.trial_ends_at) : null,
    cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    couponId: r.coupon_id ?? null,
    couponCode: r.coupon_code ?? null,
    discountPercent: Number(r.discount_percent),
    discountFixed: Number(r.discount_fixed),
    nextInvoiceAmount: Number(r.next_invoice_amount),
    currency: r.currency,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaymentMethod(r: any): PaymentMethod {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    type: r.type,
    label: r.label,
    last4: r.last4 ?? null,
    brand: r.brand ?? null,
    expMonth: r.exp_month ?? null,
    expYear: r.exp_year ?? null,
    bankName: r.bank_name ?? null,
    bankAccountLast4: r.bank_account_last4 ?? null,
    isDefault: r.is_default,
    isActive: r.is_active,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(r: any): Invoice {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name ?? undefined,
    subscriptionId: r.subscription_id ?? null,
    number: r.number,
    status: r.status,
    amountDue: Number(r.amount_due),
    amountPaid: Number(r.amount_paid),
    currency: r.currency,
    billingPeriodStart: String(r.billing_period_start),
    billingPeriodEnd: String(r.billing_period_end),
    dueDate: String(r.due_date),
    paidAt: r.paid_at ? String(r.paid_at) : null,
    lineItems: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : (r.line_items ?? []),
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUsageRecord(r: any): UsageRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    metric: r.metric,
    periodStart: String(r.period_start),
    periodEnd: String(r.period_end),
    currentValue: Number(r.current_value),
    limitValue: r.limit_value != null ? Number(r.limit_value) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ── Plans ──────────────────────────────────────────────────────────────────────
export async function findAllPlans(filter: PlanListFilter = {}): Promise<SubscriptionPlan[]> {
  const conditions: string[] = ['1=1'];
  if (!filter.includeInactive) conditions.push('is_active = true');
  if (filter.publicOnly) conditions.push('is_public = true');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.subscription_plans WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC`,
  ) as unknown[];
  return (rows as unknown[]).map(mapPlan);
}

export async function findPlanById(id: string): Promise<SubscriptionPlan | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.subscription_plans WHERE id = $1::uuid`,
    id,
  ) as unknown[];
  return (rows as unknown[]).length ? mapPlan((rows as unknown[])[0]) : null;
}

export async function findPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.subscription_plans WHERE slug = $1`,
    slug,
  ) as unknown[];
  return (rows as unknown[]).length ? mapPlan((rows as unknown[])[0]) : null;
}

export async function createPlan(dto: CreatePlanDto): Promise<SubscriptionPlan> {
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, currency, max_users, max_frameworks,
       max_evidence_gb, max_branches, max_departments, features, is_public, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
    RETURNING *
  `,
    dto.name, dto.slug, dto.description ?? null, dto.priceMonthly, dto.priceYearly,
    dto.currency ?? 'USD', dto.maxUsers ?? null, dto.maxFrameworks ?? null,
    dto.maxEvidenceGb ?? null, dto.maxBranches ?? null, dto.maxDepartments ?? null,
    JSON.stringify(dto.features ?? []), dto.isPublic ?? true, dto.sortOrder ?? 0,
  ) as unknown[];
  return mapPlan((rows as unknown[])[0]);
}

// Prisma's $queryRawUnsafe binds every JS string parameter as `text`, and
// Postgres has no implicit text→uuid or text→timestamptz *assignment* cast. A
// SET clause that writes a string into one of those columns therefore fails
// with 42883 ("column is of type uuid but expression is of type text") unless
// the placeholder is cast explicitly — which is why `WHERE id = $n::uuid` was
// already cast here but the SET clauses were not, breaking every plan change.
//
// Columns not listed are varchar/numeric/boolean/jsonb, which accept the type
// Prisma binds them as. Keyed by column name across the billing tables; the
// names are unique enough that one map serves all four update builders.
const BILLING_COLUMN_CASTS: Record<string, string> = {
  plan_id:              '::uuid',
  coupon_id:            '::uuid',
  subscription_id:      '::uuid',
  tenant_id:            '::uuid',
  created_by:           '::uuid',
  current_period_start: '::timestamptz',
  current_period_end:   '::timestamptz',
  trial_ends_at:        '::timestamptz',
  cancelled_at:         '::timestamptz',
  expires_at:           '::timestamptz',
  paid_at:              '::timestamptz',
  due_date:             '::timestamptz',
  billing_period_start: '::timestamptz',
  billing_period_end:   '::timestamptz',
};

// Builds a single `col = $n[::cast]` assignment for a dynamic UPDATE.
function assign(col: string, idx: number): string {
  return `${col} = $${idx}${BILLING_COLUMN_CASTS[col] ?? ''}`;
}

export async function updatePlan(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;
  const add = (col: string, val: unknown) => { setClauses.push(assign(col, idx++)); values.push(val); };

  if (dto.name !== undefined) add('name', dto.name);
  if (dto.slug !== undefined) add('slug', dto.slug);
  if (dto.description !== undefined) add('description', dto.description);
  if (dto.priceMonthly !== undefined) add('price_monthly', dto.priceMonthly);
  if (dto.priceYearly !== undefined) add('price_yearly', dto.priceYearly);
  if (dto.currency !== undefined) add('currency', dto.currency);
  if ('maxUsers' in dto) add('max_users', dto.maxUsers ?? null);
  if ('maxFrameworks' in dto) add('max_frameworks', dto.maxFrameworks ?? null);
  if ('maxEvidenceGb' in dto) add('max_evidence_gb', dto.maxEvidenceGb ?? null);
  if ('maxBranches' in dto) add('max_branches', dto.maxBranches ?? null);
  if ('maxDepartments' in dto) add('max_departments', dto.maxDepartments ?? null);
  if (dto.features !== undefined) setClauses.push(`features = $${idx++}::jsonb`), values.push(JSON.stringify(dto.features));
  if (dto.isPublic !== undefined) add('is_public', dto.isPublic);
  if (dto.isActive !== undefined) add('is_active', dto.isActive);
  if (dto.sortOrder !== undefined) add('sort_order', dto.sortOrder);

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE global.subscription_plans SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    ...values,
  ) as unknown[];
  return (rows as unknown[]).length ? mapPlan((rows as unknown[])[0]) : null;
}

// ── Coupons ────────────────────────────────────────────────────────────────────
export async function findAllCoupons(includeInactive = false): Promise<Coupon[]> {
  const where = includeInactive ? '1=1' : 'is_active = true';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.coupons WHERE ${where} ORDER BY created_at DESC`,
  ) as unknown[];
  return (rows as unknown[]).map(mapCoupon);
}

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.coupons WHERE code = upper($1)`,
    code,
  ) as unknown[];
  return (rows as unknown[]).length ? mapCoupon((rows as unknown[])[0]) : null;
}

export async function findCouponById(id: string): Promise<Coupon | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.coupons WHERE id = $1::uuid`,
    id,
  ) as unknown[];
  return (rows as unknown[]).length ? mapCoupon((rows as unknown[])[0]) : null;
}

export async function createCoupon(dto: CreateCouponDto, createdBy: string | null): Promise<Coupon> {
  const slugs = dto.applicablePlanSlugs ?? [];
  const slugArray = `{${slugs.map((s) => `"${s}"`).join(',')}}`;
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.coupons
      (code, name, description, discount_type, discount_value, currency, max_uses, min_amount,
       applicable_plan_slugs, expires_at, created_by)
    VALUES (upper($1),$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11)
    RETURNING *
  `,
    dto.code, dto.name, dto.description ?? null, dto.discountType, dto.discountValue,
    dto.currency ?? 'USD', dto.maxUses ?? null, dto.minAmount ?? 0,
    slugArray, dto.expiresAt ?? null, createdBy,
  ) as unknown[];
  return mapCoupon((rows as unknown[])[0]);
}

export async function updateCoupon(id: string, dto: UpdateCouponDto): Promise<Coupon | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;
  const add = (col: string, val: unknown) => { setClauses.push(assign(col, idx++)); values.push(val); };

  if (dto.name !== undefined) add('name', dto.name);
  if (dto.description !== undefined) add('description', dto.description);
  if (dto.discountType !== undefined) add('discount_type', dto.discountType);
  if (dto.discountValue !== undefined) add('discount_value', dto.discountValue);
  if (dto.currency !== undefined) add('currency', dto.currency);
  if ('maxUses' in dto) add('max_uses', dto.maxUses ?? null);
  if (dto.minAmount !== undefined) add('min_amount', dto.minAmount);
  if (dto.isActive !== undefined) add('is_active', dto.isActive);
  if (dto.expiresAt !== undefined) add('expires_at', dto.expiresAt ?? null);
  if (dto.applicablePlanSlugs !== undefined) {
    const arr = `{${dto.applicablePlanSlugs.map((s) => `"${s}"`).join(',')}}`;
    setClauses.push(`applicable_plan_slugs = $${idx++}::text[]`);
    values.push(arr);
  }

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE global.coupons SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    ...values,
  ) as unknown[];
  return (rows as unknown[]).length ? mapCoupon((rows as unknown[])[0]) : null;
}

export async function incrementCouponUses(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.coupons SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = $1::uuid`,
    id,
  );
}

export async function recordCouponRedemption(couponId: string, tenantId: string, subscriptionId: string | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO global.coupon_redemptions (coupon_id, tenant_id, subscription_id) VALUES ($1::uuid,$2::uuid,$3::uuid)`,
    couponId, tenantId, subscriptionId,
  );
}

// ── Subscriptions ──────────────────────────────────────────────────────────────
export async function findSubscriptionByTenant(tenantId: string): Promise<Subscription | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT s.*, p.name AS plan_name, p.slug AS plan_slug, c.code AS coupon_code
    FROM global.subscriptions s
    JOIN global.subscription_plans p ON p.id = s.plan_id
    LEFT JOIN global.coupons c ON c.id = s.coupon_id
    WHERE s.tenant_id = $1::uuid
    ORDER BY s.created_at DESC
    LIMIT 1
  `, tenantId) as unknown[];
  return (rows as unknown[]).length ? mapSubscription((rows as unknown[])[0]) : null;
}

export async function findSubscriptionById(id: string): Promise<Subscription | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT s.*, p.name AS plan_name, p.slug AS plan_slug, c.code AS coupon_code
    FROM global.subscriptions s
    JOIN global.subscription_plans p ON p.id = s.plan_id
    LEFT JOIN global.coupons c ON c.id = s.coupon_id
    WHERE s.id = $1::uuid
  `, id) as unknown[];
  return (rows as unknown[]).length ? mapSubscription((rows as unknown[])[0]) : null;
}

export async function createSubscription(dto: CreateSubscriptionDto & {
  tenantId: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  couponId: string | null;
  discountPercent: number;
  discountFixed: number;
  nextInvoiceAmount: number;
  currency: string;
}): Promise<Subscription> {
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.subscriptions
      (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end,
       trial_ends_at, coupon_id, discount_percent, discount_fixed, next_invoice_amount, currency)
    VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12)
    RETURNING *
  `,
    dto.tenantId, dto.planId, dto.status, dto.billingCycle,
    dto.currentPeriodStart, dto.currentPeriodEnd, dto.trialEndsAt,
    dto.couponId, dto.discountPercent, dto.discountFixed, dto.nextInvoiceAmount, dto.currency,
  ) as unknown[];

  const sub = (rows as unknown[])[0];
  const plan = await findPlanById(dto.planId);
  return mapSubscription({ ...(sub as object), plan_name: plan?.name, plan_slug: plan?.slug, coupon_code: null });
}

// Columns a subscription update is allowed to touch. Any other key (e.g. an
// attacker-supplied `next_invoice_amount = (SELECT ...)` sub-select via the
// admin endpoint's raw req.body) is rejected before it reaches the SQL, so the
// column name can never be attacker-controlled.
const UPDATABLE_SUBSCRIPTION_COLUMNS = new Set([
  'plan_id', 'status', 'billing_cycle', 'current_period_start', 'current_period_end',
  'trial_ends_at', 'cancelled_at', 'cancel_at_period_end', 'coupon_id',
  'discount_percent', 'discount_fixed', 'next_invoice_amount', 'currency',
]);

export async function updateSubscription(id: string, fields: Record<string, unknown>): Promise<Subscription | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(fields)) {
    if (!UPDATABLE_SUBSCRIPTION_COLUMNS.has(key)) {
      throw new AppError(`Invalid subscription field: ${key}`, 400, 'INVALID_FIELD');
    }
    // key is validated against the allowlist above → safe to interpolate.
    setClauses.push(assign(key, idx++));
    values.push(val);
  }

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE global.subscriptions SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid
    RETURNING *
  `, ...values) as unknown[];

  if (!(rows as unknown[]).length) return null;
  return findSubscriptionById(id);
}

// Find all active subscriptions due for renewal (current_period_end <= cutoff)
export async function findDueSubscriptions(cutoff: Date): Promise<Array<{
  id: string; tenant_id: string; schema_name: string; tenant_name: string;
  plan_id: string; plan_name: string; plan_slug: string;
  billing_cycle: string; cancel_at_period_end: boolean;
  current_period_start: Date; current_period_end: Date;
  coupon_id: string | null; discount_percent: number; discount_fixed: number;
  currency: string; price_monthly: number; price_yearly: number;
}>> {
  return prisma.$queryRawUnsafe(`
    SELECT s.id, s.tenant_id, t.schema_name, t.name AS tenant_name,
           s.plan_id, p.name AS plan_name, p.slug AS plan_slug,
           s.billing_cycle, s.cancel_at_period_end,
           s.current_period_start, s.current_period_end,
           s.coupon_id, s.discount_percent, s.discount_fixed, s.currency,
           p.price_monthly, p.price_yearly
    FROM global.subscriptions s
    JOIN global.tenants t ON t.id = s.tenant_id
    JOIN global.subscription_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','past_due')
      AND s.current_period_end <= $1
      AND t.deleted_at IS NULL
    ORDER BY s.current_period_end ASC
  `, cutoff) as unknown as Promise<unknown[]> as unknown as Promise<Array<{
    id: string; tenant_id: string; schema_name: string; tenant_name: string;
    plan_id: string; plan_name: string; plan_slug: string;
    billing_cycle: string; cancel_at_period_end: boolean;
    current_period_start: Date; current_period_end: Date;
    coupon_id: string | null; discount_percent: number; discount_fixed: number;
    currency: string; price_monthly: number; price_yearly: number;
  }>>;
}

// ── Payment Methods ────────────────────────────────────────────────────────────
export async function findPaymentMethods(tenantId: string): Promise<PaymentMethod[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.payment_methods WHERE tenant_id = $1::uuid AND is_active = true ORDER BY is_default DESC, created_at ASC`,
    tenantId,
  ) as unknown[];
  return (rows as unknown[]).map(mapPaymentMethod);
}

export async function findPaymentMethodById(id: string, tenantId: string): Promise<PaymentMethod | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.payment_methods WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    id, tenantId,
  ) as unknown[];
  return (rows as unknown[]).length ? mapPaymentMethod((rows as unknown[])[0]) : null;
}

export async function addPaymentMethod(tenantId: string, dto: AddPaymentMethodDto): Promise<PaymentMethod> {
  if (dto.setAsDefault) {
    await prisma.$executeRawUnsafe(
      `UPDATE global.payment_methods SET is_default = false WHERE tenant_id = $1::uuid`,
      tenantId,
    );
  }
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.payment_methods
      (tenant_id, type, label, last4, brand, exp_month, exp_year, bank_name, bank_account_last4, is_default)
    VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `,
    tenantId, dto.type, dto.label, dto.last4 ?? null, dto.brand ?? null,
    dto.expMonth ?? null, dto.expYear ?? null, dto.bankName ?? null,
    dto.bankAccountLast4 ?? null, dto.setAsDefault ?? false,
  ) as unknown[];
  return mapPaymentMethod((rows as unknown[])[0]);
}

/**
 * Records the reusable card token returned by a successful charge.
 *
 * Upserts on (tenant, authorization_code) so paying twice with the same card
 * refreshes the token rather than stacking duplicate rows, and makes it the
 * default so the renewal job has an unambiguous instrument to charge.
 */
export async function saveAuthorization(input: {
  tenantId: string;
  authorizationCode: string;
  email: string;
  last4: string | null;
  brand: string | null;
  expMonth: string | null;
  expYear: string | null;
  bank: string | null;
  channel: string | null;
}): Promise<void> {
  const label = input.brand && input.last4
    ? `${input.brand} •••• ${input.last4}`
    : input.bank ?? 'Saved payment method';

  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_default = false WHERE tenant_id = $1::uuid`,
    input.tenantId,
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO global.payment_methods
      (tenant_id, type, label, last4, brand, exp_month, exp_year, bank_name,
       provider, authorization_code, authorization_email, is_reusable, is_default, is_active)
    VALUES ($1::uuid, $2, $3, $4, $5, $6::int, $7::int, $8,
            'paystack', $9, $10, true, true, true)
    ON CONFLICT (tenant_id, authorization_code) WHERE authorization_code IS NOT NULL
    DO UPDATE SET
      label = EXCLUDED.label, last4 = EXCLUDED.last4, brand = EXCLUDED.brand,
      exp_month = EXCLUDED.exp_month, exp_year = EXCLUDED.exp_year,
      authorization_email = EXCLUDED.authorization_email,
      is_reusable = true, is_default = true, is_active = true, updated_at = NOW()
  `,
    input.tenantId,
    input.channel === 'card' ? 'card' : 'bank',
    label,
    input.last4,
    input.brand,
    input.expMonth ? Number(input.expMonth) : null,
    input.expYear ? Number(input.expYear) : null,
    input.bank,
    input.authorizationCode,
    input.email,
  );
}

/** The instrument the renewal job should charge, if the tenant has one. */
export async function findChargeableAuthorization(
  tenantId: string,
): Promise<{ authorizationCode: string; email: string; label: string } | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT authorization_code AS "authorizationCode",
           authorization_email AS "email",
           label
      FROM global.payment_methods
     WHERE tenant_id = $1::uuid
       AND is_active = true
       AND is_reusable = true
       AND authorization_code IS NOT NULL
       AND authorization_email IS NOT NULL
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1
  `, tenantId) as Array<{ authorizationCode: string; email: string; label: string }>;
  return rows[0] ?? null;
}

/**
 * Marks an invoice settled.
 *
 * Nothing wrote amount_paid or paid_at anywhere in the codebase, so a customer
 * who had paid still saw an open invoice for the full balance — and could
 * download a PDF saying so — while the ledger reported zero collected against
 * real Paystack settlements.
 */
export async function markInvoicePaid(
  invoiceId: string,
  amountPaid: number,
  paidAt: Date,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE global.invoices
       SET amount_paid = $2,
           paid_at     = $3::timestamptz,
           status      = CASE WHEN $2 >= amount_due THEN 'paid' ELSE 'partial' END,
           updated_at  = NOW()
     WHERE id = $1::uuid
  `, invoiceId, amountPaid, paidAt);
}

/**
 * The invoice a payment should settle: the most recent unpaid one for the
 * tenant. Returns null when there is nothing outstanding, in which case the
 * caller records a fresh paid invoice instead of inventing a settlement.
 */
export async function findOpenInvoice(tenantId: string): Promise<Invoice | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT * FROM global.invoices
     WHERE tenant_id = $1::uuid
       AND status IN ('open', 'partial', 'past_due')
     ORDER BY created_at DESC
     LIMIT 1
  `, tenantId) as unknown[];
  return rows.length ? mapInvoice(rows[0]) : null;
}

export async function setDefaultPaymentMethod(id: string, tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_default = false WHERE tenant_id = $1::uuid`,
    tenantId,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_default = true, updated_at = NOW() WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    id, tenantId,
  );
}

export async function removePaymentMethod(id: string, tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    id, tenantId,
  );
}

// ── Invoices ───────────────────────────────────────────────────────────────────
export async function findInvoices(filter: InvoiceListFilter = {}): Promise<Invoice[]> {
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let idx = 1;

  if (filter.tenantId) { conditions.push(`i.tenant_id = $${idx++}::uuid`); values.push(filter.tenantId); }
  if (filter.status) { conditions.push(`i.status = $${idx++}`); values.push(filter.status); }

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  values.push(limit, offset);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT i.*, t.name AS tenant_name
    FROM global.invoices i
    LEFT JOIN global.tenants t ON t.id = i.tenant_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.created_at DESC
    LIMIT $${idx++} OFFSET $${idx}
  `, ...values) as unknown[];
  return (rows as unknown[]).map(mapInvoice);
}

export async function findInvoiceById(id: string, tenantId?: string): Promise<Invoice | null> {
  const where = tenantId ? `i.id = $1::uuid AND i.tenant_id = $2::uuid` : `i.id = $1::uuid`;
  const args = tenantId ? [id, tenantId] : [id];
  const rows = await prisma.$queryRawUnsafe(`
    SELECT i.*, t.name AS tenant_name
    FROM global.invoices i
    LEFT JOIN global.tenants t ON t.id = i.tenant_id
    WHERE ${where}
  `, ...args) as unknown[];
  return (rows as unknown[]).length ? mapInvoice((rows as unknown[])[0]) : null;
}

export async function createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.invoices
      (tenant_id, subscription_id, amount_due, currency, billing_period_start, billing_period_end, due_date, line_items, metadata)
    VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
    RETURNING *
  `,
    dto.tenantId, dto.subscriptionId ?? null, dto.amountDue, dto.currency ?? 'USD',
    dto.billingPeriodStart, dto.billingPeriodEnd, dto.dueDate,
    JSON.stringify(dto.lineItems), JSON.stringify(dto.metadata ?? {}),
  ) as unknown[];
  return mapInvoice((rows as unknown[])[0]);
}

export async function updateInvoice(id: string, dto: UpdateInvoiceDto): Promise<Invoice | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;
  if (dto.status !== undefined) { setClauses.push(assign('status', idx++)); values.push(dto.status); }
  if (dto.amountPaid !== undefined) { setClauses.push(assign('amount_paid', idx++)); values.push(dto.amountPaid); }
  if ('paidAt' in dto) { setClauses.push(assign('paid_at', idx++)); values.push(dto.paidAt ?? null); }

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE global.invoices SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    ...values,
  ) as unknown[];
  return (rows as unknown[]).length ? mapInvoice((rows as unknown[])[0]) : null;
}

// ── Usage Records ──────────────────────────────────────────────────────────────
export async function findUsageByTenant(tenantId: string, periodStart: Date): Promise<UsageRecord[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.usage_records WHERE tenant_id = $1::uuid AND period_start = $2`,
    tenantId, periodStart,
  ) as unknown[];
  return (rows as unknown[]).map(mapUsageRecord);
}

export async function upsertUsageRecord(
  tenantId: string, metric: UsageMetric, periodStart: Date, periodEnd: Date,
  currentValue: number, limitValue: number | null,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.usage_records (tenant_id, metric, period_start, period_end, current_value, limit_value)
    VALUES ($1::uuid,$2,$3,$4,$5,$6)
    ON CONFLICT (tenant_id, metric, period_start)
    DO UPDATE SET current_value = $5, limit_value = $6, updated_at = NOW()
  `, tenantId, metric, periodStart, periodEnd, currentValue, limitValue);
}

// ── Admin ──────────────────────────────────────────────────────────────────────
export async function findAllTenantBilling(): Promise<TenantBillingRow[]> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
      p.name AS plan_name, p.slug AS plan_slug,
      s.status AS subscription_status, s.billing_cycle, s.current_period_end,
      s.next_invoice_amount, s.currency,
      COALESCE(inv_agg.total_invoiced, 0) AS total_invoiced,
      COALESCE(inv_agg.total_paid, 0) AS total_paid
    FROM global.tenants t
    LEFT JOIN global.subscriptions s ON s.tenant_id = t.id
    LEFT JOIN global.subscription_plans p ON p.id = s.plan_id
    LEFT JOIN (
      SELECT tenant_id,
             SUM(amount_due) AS total_invoiced,
             SUM(amount_paid) AS total_paid
      FROM global.invoices
      WHERE status != 'void'
      GROUP BY tenant_id
    ) inv_agg ON inv_agg.tenant_id = t.id
    WHERE t.deleted_at IS NULL
    ORDER BY t.name ASC
  `) as unknown[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows as unknown[]).map((r: any) => ({
    tenantId: r.tenant_id,
    tenantName: r.tenant_name,
    tenantSlug: r.tenant_slug,
    planName: r.plan_name ?? null,
    planSlug: r.plan_slug ?? null,
    subscriptionStatus: r.subscription_status ?? null,
    billingCycle: r.billing_cycle ?? null,
    currentPeriodEnd: r.current_period_end ? String(r.current_period_end) : null,
    nextInvoiceAmount: r.next_invoice_amount != null ? Number(r.next_invoice_amount) : null,
    totalInvoiced: Number(r.total_invoiced),
    totalPaid: Number(r.total_paid),
    currency: r.currency ?? 'USD',
  }));
}

/**
 * Creates or updates the price for one (plan, currency) pair.
 *
 * Used to keep global.plan_prices — which checkout charges from — in step with
 * edits made to a plan in the owner console, which writes the legacy price
 * columns on subscription_plans.
 */
export async function upsertPlanPrice(
  planId: string,
  currency: string,
  priceMonthly: number,
  priceYearly: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
     VALUES ($1::uuid, UPPER($2), $3, $4)
     ON CONFLICT (plan_id, currency)
     DO UPDATE SET price_monthly = EXCLUDED.price_monthly,
                   price_yearly  = EXCLUDED.price_yearly,
                   updated_at    = NOW()`,
    planId,
    currency,
    priceMonthly,
    priceYearly,
  );

  // Mirror back onto the plan when this IS the plan's own currency.
  //
  // Two live price sources with a one-way sync is how a customer ends up
  // charged one figure and invoiced another: checkout reads plan_prices, while
  // the upgrade guard, next_invoice_amount, the first invoice and every renewal
  // read subscription_plans.price_monthly/yearly. Editing a price in the owner
  // console wrote only plan_prices, so the two drifted apart silently from the
  // first edit — and because the free/paid decision in the upgrade guard reads
  // the plan column, a plan left at 0 there was handed out without payment.
  //
  // Scoped to the matching currency: a USD row must never overwrite an NGN
  // plan's headline price.
  await prisma.$executeRawUnsafe(
    `UPDATE global.subscription_plans
        SET price_monthly = $2, price_yearly = $3, updated_at = NOW()
      WHERE id = $1::uuid
        AND UPPER(COALESCE(currency, 'NGN')) = UPPER($4)`,
    planId,
    priceMonthly,
    priceYearly,
    currency,
  );
}

/** Every active per-currency price row for a plan. */
export async function findPlanPricesByPlan(planId: string): Promise<
  Array<{ currency: string; priceMonthly: number; priceYearly: number }>
> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT currency, price_monthly, price_yearly
       FROM global.plan_prices WHERE plan_id = $1::uuid AND is_active ORDER BY currency`,
    planId,
  )) as Array<{ currency: string; price_monthly: string; price_yearly: string }>;
  return rows.map((r) => ({
    currency: String(r.currency).trim(),
    priceMonthly: Number(r.price_monthly),
    priceYearly: Number(r.price_yearly),
  }));
}
