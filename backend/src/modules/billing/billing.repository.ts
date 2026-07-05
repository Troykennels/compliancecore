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

  // Seed default plans
  await prisma.$executeRawUnsafe(`
    INSERT INTO global.subscription_plans
      (name, slug, description, price_monthly, price_yearly, max_users, max_frameworks, max_evidence_gb, max_branches, max_departments, features, sort_order)
    VALUES
      ('Starter', 'starter', 'Perfect for small teams getting started with compliance', 0, 0, 3, 2, 1, 1, 5,
       '["2 compliance frameworks","3 team members","1 GB evidence storage","Community support","Basic audit trail"]', 1),
      ('Professional', 'professional', 'For growing organisations with serious compliance needs', 99, 990, 15, 5, 10, 5, 20,
       '["5 compliance frameworks","15 team members","10 GB evidence storage","Email support","Full audit trail","Custom controls","Scheduled reports","AI tools"]', 2),
      ('Enterprise', 'enterprise', 'Unlimited compliance management for large organisations', 299, 2990, NULL, NULL, NULL, NULL, NULL,
       '["Unlimited frameworks","Unlimited team members","Unlimited storage","Priority support","SSO / SCIM","Custom branding","API access","Data residency choice","Dedicated CSM"]', 3),
      ('MSP', 'msp', 'Managed service provider plan for multi-client management', 499, 4990, NULL, NULL, NULL, NULL, NULL,
       '["All Enterprise features","Multi-tenant management","White-label portal","Client reporting dashboard","Bulk onboarding","Volume discounts"]', 4)
    ON CONFLICT (slug) DO NOTHING
  `);

  _initialized = true;
  logger.info('Billing tables initialised');
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
    `SELECT * FROM global.subscription_plans WHERE id = $1`,
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

export async function updatePlan(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;
  const add = (col: string, val: unknown) => { setClauses.push(`${col} = $${idx++}`); values.push(val); };

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
    `UPDATE global.subscription_plans SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
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
    `SELECT * FROM global.coupons WHERE id = $1`,
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
  const add = (col: string, val: unknown) => { setClauses.push(`${col} = $${idx++}`); values.push(val); };

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
    `UPDATE global.coupons SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    ...values,
  ) as unknown[];
  return (rows as unknown[]).length ? mapCoupon((rows as unknown[])[0]) : null;
}

export async function incrementCouponUses(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.coupons SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = $1`,
    id,
  );
}

export async function recordCouponRedemption(couponId: string, tenantId: string, subscriptionId: string | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO global.coupon_redemptions (coupon_id, tenant_id, subscription_id) VALUES ($1,$2,$3)`,
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
    WHERE s.tenant_id = $1
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
    WHERE s.id = $1
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
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
    setClauses.push(`${key} = $${idx++}`);
    values.push(val);
  }

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE global.subscriptions SET ${setClauses.join(', ')} WHERE id = $${idx}
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
    `SELECT * FROM global.payment_methods WHERE tenant_id = $1 AND is_active = true ORDER BY is_default DESC, created_at ASC`,
    tenantId,
  ) as unknown[];
  return (rows as unknown[]).map(mapPaymentMethod);
}

export async function findPaymentMethodById(id: string, tenantId: string): Promise<PaymentMethod | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.payment_methods WHERE id = $1 AND tenant_id = $2`,
    id, tenantId,
  ) as unknown[];
  return (rows as unknown[]).length ? mapPaymentMethod((rows as unknown[])[0]) : null;
}

export async function addPaymentMethod(tenantId: string, dto: AddPaymentMethodDto): Promise<PaymentMethod> {
  if (dto.setAsDefault) {
    await prisma.$executeRawUnsafe(
      `UPDATE global.payment_methods SET is_default = false WHERE tenant_id = $1`,
      tenantId,
    );
  }
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO global.payment_methods
      (tenant_id, type, label, last4, brand, exp_month, exp_year, bank_name, bank_account_last4, is_default)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `,
    tenantId, dto.type, dto.label, dto.last4 ?? null, dto.brand ?? null,
    dto.expMonth ?? null, dto.expYear ?? null, dto.bankName ?? null,
    dto.bankAccountLast4 ?? null, dto.setAsDefault ?? false,
  ) as unknown[];
  return mapPaymentMethod((rows as unknown[])[0]);
}

export async function setDefaultPaymentMethod(id: string, tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_default = false WHERE tenant_id = $1`,
    tenantId,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_default = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    id, tenantId,
  );
}

export async function removePaymentMethod(id: string, tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    id, tenantId,
  );
}

// ── Invoices ───────────────────────────────────────────────────────────────────
export async function findInvoices(filter: InvoiceListFilter = {}): Promise<Invoice[]> {
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let idx = 1;

  if (filter.tenantId) { conditions.push(`i.tenant_id = $${idx++}`); values.push(filter.tenantId); }
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
  const where = tenantId ? `i.id = $1 AND i.tenant_id = $2` : `i.id = $1`;
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
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
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
  if (dto.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(dto.status); }
  if (dto.amountPaid !== undefined) { setClauses.push(`amount_paid = $${idx++}`); values.push(dto.amountPaid); }
  if ('paidAt' in dto) { setClauses.push(`paid_at = $${idx++}`); values.push(dto.paidAt ?? null); }

  values.push(id);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE global.invoices SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    ...values,
  ) as unknown[];
  return (rows as unknown[]).length ? mapInvoice((rows as unknown[])[0]) : null;
}

// ── Usage Records ──────────────────────────────────────────────────────────────
export async function findUsageByTenant(tenantId: string, periodStart: Date): Promise<UsageRecord[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM global.usage_records WHERE tenant_id = $1 AND period_start = $2`,
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
    VALUES ($1,$2,$3,$4,$5,$6)
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
