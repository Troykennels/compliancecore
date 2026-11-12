import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import pg from 'pg';

/**
 * Plan gating (ComplianceCore gating prompt 2026), against a live disposable
 * Postgres with email and notifications stubbed. Covers the catalogue and
 * grandfathering, module locks by plan and role (incl. direct API calls), the
 * states, checkout and plan-switch eligibility, the AI allowance, reminders,
 * refunds/disputes/forged webhooks, plan history, upgrade requests and
 * branding validation and isolation. Nothing talks to Paystack or sends mail.
 */

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_fixture_only';

const sendRawEmail = vi.fn().mockResolvedValue(undefined);
const createForUser = vi.fn().mockResolvedValue(undefined);
vi.mock('bullmq', () => ({ Queue: class {}, Worker: class {} }));
vi.mock('../../src/config/redis', () => ({ redisForQueues: {} }));
vi.mock('../../src/lib/email', () => ({ email: { sendRawEmail: (...a: unknown[]) => sendRawEmail(...a) } }));
vi.mock('../../src/modules/notifications/notification.service', () => ({ notificationService: { createForUser: (...a: unknown[]) => createForUser(...a) } }));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe.skipIf(!TEST_DB)('plan gating, catalogue 2026.2', () => {
  let client: pg.Client;
  const plan: Record<string, string> = {};
  let tenantId: string;
  let otherTenantId: string;
  let ownerId: string;
  let viewerId: string;

  beforeAll(async () => {
    const target = new URL(TEST_DB!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/compliance_renewal_task_')) {
      throw Error('Dedicated local disposable database required');
    }
    process.env.DATABASE_URL = TEST_DB;
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: TEST_DB } });
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository');
    await initBillingTables();
    for (const r of (await client.query(`SELECT id, slug FROM global.subscription_plans`)).rows) plan[r.slug] = r.id;
  }, 120_000);

  afterAll(async () => { await client?.end(); });

  beforeEach(async () => {
    sendRawEmail.mockClear();
    createForUser.mockClear();
    await client.query(`DELETE FROM global.upgrade_requests`);
    await client.query(`DELETE FROM global.ai_usage`);
    await client.query(`DELETE FROM global.payment_issues`);
    await client.query(`DELETE FROM global.payment_transactions`);
    await client.query(`DELETE FROM global.subscriptions`);
    await client.query(`DELETE FROM global.tenant_memberships`);
    await client.query(`DELETE FROM global.users WHERE email LIKE 'gate-%'`);
    await client.query(`DELETE FROM global.tenants WHERE slug LIKE 'gate-%'`);
    const t = async (name: string) => (await client.query(
      `INSERT INTO global.tenants (name, slug, schema_name, address, city, updated_at)
       VALUES ($1, 'gate-' || substr(md5(random()::text),1,8), 'tenant_' || substr(md5(random()::text),1,32), '1 Marina', 'Lagos', NOW()) RETURNING id`, [name])).rows[0].id;
    tenantId = await t('Gate Co');
    otherTenantId = await t('Other Co');
    const u = async (role: string) => {
      const id = (await client.query(
        `INSERT INTO global.users (email, password_hash, first_name, last_name, updated_at)
         VALUES ('gate-' || substr(md5(random()::text),1,8) || '@example.com', 'x', 'Gate', $1, NOW()) RETURNING id`, [role])).rows[0].id;
      await client.query(`INSERT INTO global.tenant_memberships (tenant_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3)`, [tenantId, id, role]);
      return id;
    };
    ownerId = await u('owner');
    viewerId = await u('viewer');
  });

  async function subscribe(slug: string, opts: { status?: string; daysOut?: number; tenant?: string } = {}) {
    const days = opts.daysOut ?? 30;
    await client.query(`DELETE FROM global.subscriptions WHERE tenant_id = $1::uuid`, [opts.tenant ?? tenantId]);
    await client.query(
      `INSERT INTO global.subscriptions (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end, next_invoice_amount, currency)
       VALUES ($1::uuid, $2::uuid, $3, 'monthly', NOW() - interval '10 days', NOW() + ($4 || ' days')::interval, 12000, 'NGN')`,
      [opts.tenant ?? tenantId, plan[slug], opts.status ?? 'active', String(days)]);
  }

  async function gate(method: string, url: string, who: 'owner' | 'viewer' | 'superadmin' = 'owner') {
    const { enforceEntitlement } = await import('../../src/middleware/entitlement.middleware');
    const req: any = {
      method, originalUrl: url, tenant: { id: tenantId },
      user: { id: who === 'viewer' ? viewerId : ownerId, tenantId, isSuperadmin: who === 'superadmin', permissions: who === 'viewer' ? ['controls:read'] : ['*'] },
    };
    let err: any = null;
    await enforceEntitlement()(req, {} as any, (e?: unknown) => { err = e ?? null; });
    return err;
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────
  it('adds the five 2026 plans with prices, onboarding, caps and growing module sets; earlier plans stay for their customers', async () => {
    const rows = (await client.query(`SELECT slug, price_monthly, price_yearly, max_users, max_frameworks, max_evidence_gb, onboarding_fee, waive_onboarding_yearly, is_public, is_active, modules, catalog_version, max_ai_requests_monthly FROM global.subscription_plans`)).rows;
    const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
    const slugs = ['essential_2026', 'growth_2026', 'professional_2026', 'business_2026', 'enterprise_2026'];
    expect(slugs.map((s) => Number(by[s].price_monthly))).toEqual([35000, 75000, 150000, 300000, 600000]);
    expect(slugs.map((s) => Number(by[s].price_yearly))).toEqual([350000, 750000, 1500000, 3000000, 6000000]);
    expect(slugs.map((s) => Number(by[s].onboarding_fee))).toEqual([0, 100000, 250000, 500000, 1500000]);
    expect(slugs.map((s) => by[s].waive_onboarding_yearly)).toEqual([false, true, true, true, false]);
    expect(slugs.map((s) => by[s].max_frameworks)).toEqual([2, 3, 5, null, null]);
    expect(slugs.map((s) => (by[s].max_evidence_gb == null ? null : Number(by[s].max_evidence_gb)))).toEqual([5, 20, 50, 150, null]);
    // Checkout charges from plan_prices: the onboarding fee is there too.
    const prices = (await client.query(`SELECT p.slug, pp.onboarding_fee FROM global.plan_prices pp JOIN global.subscription_plans p ON p.id = pp.plan_id WHERE pp.currency = 'NGN'`)).rows;
    expect(Number(prices.find((r) => r.slug === 'professional_2026').onboarding_fee)).toBe(250000);
    expect([by.essential_2026, by.growth_2026, by.professional_2026, by.business_2026].map((p) => p.max_users)).toEqual([3, 10, 25, 50]);
    expect(by.enterprise_2026.max_users).toBeNull();
    expect(by.enterprise_2026.modules).toBeNull(); // every module
    for (const s of ['starter', 'professional', 'business', 'enterprise', 'msp']) expect(by[s]).toMatchObject({ is_public: false, is_active: true, modules: null });
    for (const s of ['essential_2026', 'growth_2026', 'professional_2026', 'business_2026', 'enterprise_2026']) expect(by[s]).toMatchObject({ is_public: true, catalog_version: '2026.2' });
    // Each bigger plan keeps every module of the smaller one.
    const order = ['essential_2026', 'growth_2026', 'professional_2026', 'business_2026'].map((s) => by[s].modules);
    for (let i = 1; i < order.length; i++) for (const [k, v] of Object.entries(order[i - 1])) if (v) expect(order[i][k]).toBe(true);
    // Nigeria Data Protection Act basics in every plan.
    for (const k of ['privacy_ropa', 'privacy_dsar', 'incidents']) expect(order[0][k]).toBe(true);
    expect(order[0].risks).toBe(false);
    expect(order[0].privacy_dpia).toBe(false);
    expect(order[1].risks).toBe(true);
    expect(order[1].privacy_dpia).toBe(true);
    expect(order[1].audits).toBe(false);
    expect(order[2].audits).toBe(true);
    expect(order[2].ai).toBe(true);
    expect(order[2].msp_portfolio).toBe(false);
    expect(order[3].msp_portfolio).toBe(true);
    expect([by.growth_2026, by.professional_2026, by.business_2026].map((p) => p.max_ai_requests_monthly)).toEqual([0, 100, 500]);
  });

  it('applies the catalogue once: an owner edit survives a restart', async () => {
    await client.query(`UPDATE global.subscription_plans SET price_monthly = 13000 WHERE slug = 'essential_2026'`);
    const { initPlanCatalog2026 } = await import('../../src/modules/billing/plan-catalog-2026');
    await initPlanCatalog2026();
    expect(Number((await client.query(`SELECT price_monthly FROM global.subscription_plans WHERE slug='essential_2026'`)).rows[0].price_monthly)).toBe(13000);
    await client.query(`UPDATE global.subscription_plans SET price_monthly = 35000 WHERE slug = 'essential_2026'`);
  });

  // ── Module locks (A plan, B role, C tenant) ───────────────────────────────
  it('on Essential, locked modules refuse changes on the server (direct API) but keep existing records viewable', async () => {
    await subscribe('essential_2026');
    const write = await gate('POST', '/api/risks');
    expect(write).toMatchObject({ statusCode: 402, code: 'PLAN_UPGRADE_REQUIRED' });
    expect(write.message).toMatch(/Upgrade in Plans and upgrade/);
    expect(await gate('GET', '/api/risks?page=1')).toBeNull();          // reading stays possible
    expect(await gate('PUT', '/api/privacy/assessments/123')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' });
    // The data protection basics are open on Essential.
    for (const url of ['/api/privacy/requests', '/api/privacy/activities', '/api/incidents']) expect(await gate('POST', url)).toBeNull();
    expect(await gate('POST', '/api/policies/templates/x')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' });
    expect(await gate('GET', '/api/ai/search')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' }); // AI: every request
    // Modules whose value is reading are refused for reads too (no records of the customer's to protect).
    expect(await gate('GET', '/api/analytics/overview')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' });
    expect(await gate('GET', '/api/policies/templates/iso27001/download')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' });
    expect(await gate('GET', '/api/vendors')).toBeNull(); // the customer's own vendor records stay viewable
    // Never lockable: core work, settings and billing.
    for (const url of ['/api/tasks', '/api/controls', '/api/policies', '/api/evidence', '/api/billing/subscription', '/api/organizations/branding']) {
      expect(await gate('POST', url)).toBeNull();
    }
  });

  it('someone without billing rights is told to ask an administrator; the platform owner is never locked', async () => {
    await subscribe('essential_2026');
    expect((await gate('POST', '/api/vendors', 'viewer')).message).toMatch(/ask your administrator/);
    expect(await gate('POST', '/api/vendors', 'superadmin')).toBeNull();
  });

  it('upgrading opens the modules at once; grandfathered plans keep every module', async () => {
    await subscribe('growth_2026');
    expect(await gate('POST', '/api/risks')).toBeNull();
    expect(await gate('POST', '/api/vendors')).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED' });
    await subscribe('business_2026');
    for (const url of ['/api/vendors', '/api/ai/search', '/api/integrations', '/api/reports/scheduled']) expect(await gate('POST', url)).toBeNull();
    await subscribe('starter'); // an earlier plan, contracted before 2026
    expect(await gate('POST', '/api/ai/search')).toBeNull();
    const { getEntitlement } = await import('../../src/lib/entitlements');
    expect((await getEntitlement(tenantId)).lockedModules).toEqual([]);
  });

  it('a module lock follows the organisation, never another organisation', async () => {
    await subscribe('business_2026', { tenant: otherTenantId });
    await subscribe('essential_2026');
    const { getEntitlement } = await import('../../src/lib/entitlements');
    expect((await getEntitlement(tenantId)).lockedModules).toContain('ai');
    expect((await getEntitlement(otherTenantId)).lockedModules).toEqual([]);
  });

  it('background jobs skip modules the plan does not include', async () => {
    await subscribe('essential_2026');
    const { moduleAllowed } = await import('../../src/lib/entitlements');
    expect(await moduleAllowed(tenantId, 'escalations')).toBe(false);
    expect(await moduleAllowed(tenantId, 'scheduled_reports')).toBe(false);
    await subscribe('professional_2026');
    expect(await moduleAllowed(tenantId, 'escalations')).toBe(true);
    expect(await moduleAllowed(tenantId, 'scheduled_reports')).toBe(false);
    // A lookup problem skips a paid module's job rather than running it unpaid.
    expect(await moduleAllowed('not-a-uuid', 'escalations')).toBe(false);
  });

  it('a lookup problem never unlocks a paid module; core work still goes ahead; the switch turns locks off', async () => {
    const { enforceEntitlement } = await import('../../src/middleware/entitlement.middleware');
    const run = async (url: string) => {
      let err: any = null;
      await enforceEntitlement()({ method: 'POST', originalUrl: url, tenant: { id: 'not-a-uuid' },
        user: { id: ownerId, tenantId: 'not-a-uuid', isSuperadmin: false, permissions: ['*'] } } as any, {} as any, (e?: unknown) => { err = e ?? null; });
      return err;
    };
    expect(await run('/api/vendors')).toMatchObject({ statusCode: 503, code: 'ENTITLEMENT_UNAVAILABLE' });
    expect(await run('/api/tasks')).toBeNull();
    await subscribe('essential_2026');
    process.env.PLAN_MODULE_LOCKS = 'off';
    try {
      const { getEntitlement } = await import('../../src/lib/entitlements');
      expect((await getEntitlement(tenantId)).lockedModules).toEqual([]);
    } finally { delete process.env.PLAN_MODULE_LOCKS; }
  });

  // ── States and countdown ──────────────────────────────────────────────────
  it('states: expiring in the last 14 days, suspended when paused, cancelled after grace; read-only blocks writes', async () => {
    const { getEntitlement } = await import('../../src/lib/entitlements');
    await subscribe('growth_2026', { daysOut: 10 });
    const e = await getEntitlement(tenantId);
    expect(e).toMatchObject({ state: 'expiring', canWrite: true });
    expect(e.hoursRemaining).toBeGreaterThan(9 * 24);
    await subscribe('growth_2026', { status: 'paused' });
    expect(await getEntitlement(tenantId)).toMatchObject({ state: 'suspended', canWrite: false });
    expect(await gate('POST', '/api/tasks')).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' });
    expect(await gate('GET', '/api/tasks')).toBeNull();
    await subscribe('growth_2026', { status: 'cancelled', daysOut: -20 });
    expect(await getEntitlement(tenantId)).toMatchObject({ state: 'cancelled', canWrite: false });
    expect(await gate('POST', '/api/payments/initialize')).toBeNull(); // paying to get out stays open
  });

  // ── Checkout and plan switch eligibility ──────────────────────────────────
  it('nobody can buy a withdrawn or quoted plan; a grandfathered customer can renew its own', async () => {
    const { checkoutQuote } = await import('../../src/modules/payments/checkout-quote');
    await client.query(`INSERT INTO global.tenant_onboarding (tenant_id, status) VALUES ($1::uuid, 'grandfathered') ON CONFLICT DO NOTHING`, [tenantId]);
    await subscribe('essential_2026');
    await expect(checkoutQuote({ tenantId, planId: plan.starter, currency: 'NGN', billingCycle: 'monthly' })).rejects.toMatchObject({ code: 'PLAN_NOT_AVAILABLE' });
    await expect(checkoutQuote({ tenantId, planId: plan.enterprise_2026, currency: 'NGN', billingCycle: 'yearly' })).rejects.toMatchObject({ code: 'PLAN_NOT_AVAILABLE' });
    const q = await checkoutQuote({ tenantId, planId: plan.growth_2026, currency: 'NGN', billingCycle: 'yearly' });
    expect(q.subscriptionAmount).toBe(750000);
    await subscribe('starter');
    await expect(checkoutQuote({ tenantId, planId: plan.starter, currency: 'NGN', billingCycle: 'monthly' })).resolves.toBeTruthy();
  });

  it('onboarding is charged once with a monthly first payment, waived for a yearly one, and never charged after a waived year', async () => {
    const { checkoutQuote } = await import('../../src/modules/payments/checkout-quote');
    const { settlePaidCheckout } = await import('../../src/modules/payments/settle-paid-checkout');
    await client.query(`DELETE FROM global.tenant_onboarding WHERE tenant_id = ANY($1::uuid[])`, [[tenantId, otherTenantId]]);
    await subscribe('professional_2026', { status: 'trial' });
    const monthly = await checkoutQuote({ tenantId, planId: plan.professional_2026, currency: 'NGN', billingCycle: 'monthly' });
    expect(monthly).toMatchObject({ subscriptionAmount: 150000, onboardingFee: 250000, total: 400000, onboardingWaived: false });
    const yearly = await checkoutQuote({ tenantId, planId: plan.professional_2026, currency: 'NGN', billingCycle: 'yearly' });
    expect(yearly).toMatchObject({ subscriptionAmount: 1500000, onboardingFee: 0, total: 1500000, onboardingWaived: true });
    // Essential has no onboarding fee at all.
    expect(await checkoutQuote({ tenantId, planId: plan.essential_2026, currency: 'NGN', billingCycle: 'monthly' })).toMatchObject({ onboardingFee: 0, onboardingWaived: false });
    // Pay the waived year: onboarding is then covered for good.
    const ref = 'gate-waive-' + Date.now();
    await client.query(`INSERT INTO global.payment_transactions (reference, tenant_id, user_id, plan_id, billing_cycle, currency, amount, onboarding_fee, subscription_amount)
      VALUES ($1, $2::uuid, $3::uuid, $4::uuid, 'yearly', 'NGN', 1500000, 0, 1500000)`, [ref, tenantId, ownerId, plan.professional_2026]);
    await settlePaidCheckout(ref, null, new Date());
    expect((await client.query(`SELECT status FROM global.tenant_onboarding WHERE tenant_id = $1::uuid`, [tenantId])).rows[0]).toMatchObject({ status: 'paid' });
    expect(await checkoutQuote({ tenantId, planId: plan.business_2026, currency: 'NGN', billingCycle: 'monthly' })).toMatchObject({ onboardingFee: 0 });
    // The other organisation still owes onboarding on a monthly start.
    await subscribe('growth_2026', { tenant: otherTenantId, status: 'trial' });
    expect(await checkoutQuote({ tenantId: otherTenantId, planId: plan.growth_2026, currency: 'NGN', billingCycle: 'monthly' })).toMatchObject({ onboardingFee: 100000 });
  });

  it('the owner can change the onboarding fee and the yearly waiver; checkout follows, and the edit is in the history', async () => {
    const service = await import('../../src/modules/billing/billing.service');
    const { checkoutQuote } = await import('../../src/modules/payments/checkout-quote');
    await client.query(`DELETE FROM global.tenant_onboarding WHERE tenant_id = $1::uuid`, [tenantId]);
    await subscribe('growth_2026', { status: 'trial' });
    await expect(service.adminUpdatePlan(plan.growth_2026, { onboardingFee: -1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await service.adminUpdatePlan(plan.growth_2026, { onboardingFee: 80000, waiveOnboardingYearly: false }, ownerId);
    expect(await checkoutQuote({ tenantId, planId: plan.growth_2026, currency: 'NGN', billingCycle: 'yearly' })).toMatchObject({ onboardingFee: 80000, onboardingWaived: false });
    const hist = (await client.query(`SELECT changes FROM global.subscription_plan_history WHERE plan_id = $1::uuid ORDER BY changed_at DESC LIMIT 1`, [plan.growth_2026])).rows[0];
    expect(hist.changes).toMatchObject({ onboardingFee: 80000, waiveOnboardingYearly: false });
    await service.adminUpdatePlan(plan.growth_2026, { onboardingFee: 100000, waiveOnboardingYearly: true });
  });

  it('a self-service switch onto an old cheaper plan (which opens every module) is refused', async () => {
    const service = await import('../../src/modules/billing/billing.service');
    await subscribe('business_2026');
    await expect(service.updateSubscription(tenantId, { planId: plan.professional })).rejects.toMatchObject({ code: 'PLAN_NOT_AVAILABLE' });
    await expect(service.updateSubscription(tenantId, { planId: plan.enterprise_2026 })).rejects.toMatchObject({ code: 'PLAN_NOT_AVAILABLE' });
    await expect(service.updateSubscription(tenantId, { planId: plan.essential_2026 })).resolves.toBeTruthy(); // cheaper current plan: allowed
  });

  // ── AI allowance ──────────────────────────────────────────────────────────
  it('AI requests stop at the monthly allowance and start again next month', async () => {
    const { claimAiRequest, aiUsageThisMonth, releaseAiRequest } = await import('../../src/lib/ai-usage');
    const now = new Date('2026-11-12T10:00:00Z');
    expect(await claimAiRequest(tenantId, 2, now)).toBe(true);
    expect(await claimAiRequest(tenantId, 2, now)).toBe(true);
    expect(await claimAiRequest(tenantId, 2, now)).toBe(false);
    expect(await aiUsageThisMonth(tenantId, now)).toBe(2);
    expect(await claimAiRequest(tenantId, 2, new Date('2026-12-01T00:30:00Z'))).toBe(true);
    expect(await claimAiRequest(otherTenantId, 2, now)).toBe(true); // per organisation
    // A failed AI call gives its slot back.
    await releaseAiRequest(tenantId, now);
    expect(await aiUsageThisMonth(tenantId, now)).toBe(1);
    expect(await claimAiRequest(tenantId, 2, now)).toBe(true);
  });

  // ── Reminders ─────────────────────────────────────────────────────────────
  it('reminders: 14, 7, 3 and 1 days ahead and on the due date (Lagos calendar)', async () => {
    const { bandFor } = await import('../../src/jobs/subscription-reminder.job');
    const now = new Date('2026-11-12T08:00:00Z');
    const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
    expect(bandFor(at(13 * 24), now)?.threshold).toBe(14);
    expect(bandFor(at(6.5 * 24), now)?.threshold).toBe(7);
    expect(bandFor(at(2.5 * 24), now)?.threshold).toBe(3);
    expect(bandFor(at(20), now)?.threshold).toBe(1);
    expect(bandFor(at(6), now)).toEqual({ threshold: 0, days: 0 });   // later today
    expect(bandFor(at(-3), now)).toEqual({ threshold: 0, days: 0 });  // ended earlier today
    expect(bandFor(at(-30), now)).toBeNull();                         // yesterday
    expect(bandFor(at(16 * 24), now)).toBeNull();
  });

  // ── Refunds, disputes, forged webhooks ────────────────────────────────────
  it('refunds and chargebacks are recorded once each and alerted; access is not changed', async () => {
    await subscribe('growth_2026');
    await client.query(`INSERT INTO global.payment_transactions (reference, tenant_id, plan_id, billing_cycle, currency, amount, status)
      VALUES ('cc_ref_1', $1::uuid, $2::uuid, 'monthly', 'NGN', 25000, 'success')`, [tenantId, plan.growth_2026]);
    const { handleWebhook } = await import('../../src/modules/payments/payments.service');
    const send = async (body: object) => {
      const raw = Buffer.from(JSON.stringify(body));
      const sig = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex');
      await handleWebhook(raw, sig);
    };
    const refund = { event: 'refund.processed', data: { id: 77, status: 'processed', transaction_reference: 'cc_ref_1', amount: 2500000, currency: 'NGN' } };
    await send(refund);
    await send(refund); // repeated delivery
    await send({ event: 'charge.dispute.create', data: { id: 9, status: 'awaiting-merchant-feedback', refund_amount: 2500000, currency: 'NGN', transaction: { reference: 'cc_ref_1' } } });
    await send({ event: 'charge.dispute.resolve', data: { id: 9, status: 'resolved', resolution: 'merchant-accepted', transaction: { reference: 'cc_ref_1' } } });
    const issues = (await client.query(`SELECT kind, status, tenant_id, amount FROM global.payment_issues ORDER BY created_at`)).rows;
    expect(issues.map((i) => [i.kind, i.status])).toEqual([['refund', 'processed'], ['dispute', 'awaiting-merchant-feedback'], ['dispute', 'resolved']]);
    expect(issues[0]).toMatchObject({ tenant_id: tenantId });
    expect(Number(issues[0].amount)).toBe(25000);
    expect(sendRawEmail).toHaveBeenCalledTimes(3);
    const { getEntitlement } = await import('../../src/lib/entitlements');
    expect((await getEntitlement(tenantId)).canWrite).toBe(true);
  });

  it('a webhook with a forged signature is refused and recorded', async () => {
    const { handleWebhook } = await import('../../src/modules/payments/payments.service');
    await expect(handleWebhook(Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'x' } })), 'f'.repeat(128)))
      .rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    expect((await client.query(`SELECT kind, event FROM global.payment_issues`)).rows).toEqual([{ kind: 'webhook_rejected', event: 'charge.success' }]);
  });

  // ── Admin: plan history and validation ───────────────────────────────────
  it('every owner edit of a plan keeps the plan as it was; unknown modules are refused', async () => {
    const service = await import('../../src/modules/billing/billing.service');
    await service.adminUpdatePlan(plan.growth_2026, { modules: { vendors: true } }, ownerId);
    const history = await service.adminPlanHistory(plan.growth_2026);
    expect(history[0]).toMatchObject({ changedBy: ownerId, changes: { modules: { vendors: true } } });
    expect((history[0].snapshot as any).slug).toBe('growth_2026');
    await expect(service.adminUpdatePlan(plan.growth_2026, { modules: { spaceship: true } as any })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.adminUpdatePlan(plan.growth_2026, { modules: { vendors: 'yes' } as any })).rejects.toMatchObject({ statusCode: 400 });
    // Restore the full module list for the tests that follow.
    const { PLANS_2026 } = await import('../../src/modules/billing/plan-catalog-2026');
    const { modulesFor } = await import('../../src/lib/plan-modules');
    await service.adminUpdatePlan(plan.growth_2026, { modules: modulesFor(PLANS_2026[1].modules as readonly string[]) });
  });

  // ── Upgrade requests ──────────────────────────────────────────────────────
  it('someone without billing rights asks the administrators (once a day per module)', async () => {
    const { requestUpgrade } = await import('../../src/modules/billing/upgrade-request');
    const call = async () => {
      let body: any; let status = 200;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return res; } };
      await requestUpgrade({ user: { id: viewerId, tenantId, email: 'viewer@example.com' }, body: { module: 'vendors', note: 'Needed for supplier reviews' } } as any, res);
      return { status, body };
    };
    const first = await call();
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ sent: true, notified: 1 });
    expect(createForUser).toHaveBeenCalledTimes(1);
    expect(createForUser.mock.calls[0][1]).toMatchObject({ userId: ownerId, title: 'Upgrade requested: Vendors' });
    const again = await call();
    expect(again.body.data.sent).toBe(false);
    expect(createForUser).toHaveBeenCalledTimes(1);
    await expect(requestUpgrade({ user: { id: viewerId, tenantId, email: 'v@x' }, body: { module: 'nope' } } as any, {} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── Branding (every plan) ─────────────────────────────────────────────────
  it('branding is checked (real PNG/JPEG only, no SVG, size and length limits) and stays with its organisation', async () => {
    const { saveBranding, getBranding, cleanBranding } = await import('../../src/lib/branding');
    await subscribe('essential_2026'); // the smallest plan has branding too
    const saved = await saveBranding(tenantId, { legalName: '  Gate  Co  Limited ', footer: 'RC 123456 <b>x</b>', color: '#1e3a8a', logo: PNG });
    expect(saved).toMatchObject({ legalName: 'Gate Co Limited', footer: 'RC 123456 b x /b', color: '#1E3A8A', logo: PNG, address: '1 Marina, Lagos' });
    expect(() => cleanBranding({ logo: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=' })).toThrow(/PNG or JPEG/);
    expect(() => cleanBranding({ logo: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') })).toThrow(/not a real PNG/);
    expect(() => cleanBranding({ letterhead: 'data:image/png;base64,' + 'A'.repeat(500_000) })).toThrow(/under 350 KB/);
    expect(() => cleanBranding({ color: 'red' })).toThrow(/#1E3A8A/);
    expect(() => cleanBranding({ footer: 'x'.repeat(301) })).toThrow(/300/);
    expect((await getBranding(otherTenantId))?.legalName).toBeNull(); // never another organisation's
    expect(await gate('PUT', '/api/organizations/branding')).toBeNull(); // not a locked module on any plan
  });

  it('the rules cover every lockable module, and every lockable router checks the plan', async () => {
    const fs = await import('node:fs');
    const { PLAN_MODULES, moduleForPath } = await import('../../src/lib/plan-modules');
    const paths: Record<string, string> = {
      risks: '/api/risks', policy_templates: '/api/policies/templates', audits: '/api/audits/1', approvals: '/api/approvals',
      training: '/api/training', incidents: '/api/incidents', analytics: '/api/analytics/x', signatures: '/api/signatures',
      vendors: '/api/vendors', escalations: '/api/escalations', privacy_ropa: '/api/privacy/activities', privacy_dsar: '/api/privacy/requests/1',
      privacy_dpia: '/api/privacy/assessments/1/decision', scheduled_reports: '/api/reports/scheduled', integrations: '/api/integrations',
      ai: '/api/ai/search',
    };
    for (const m of PLAN_MODULES) {
      if (m.key === 'msp_portfolio') continue; // a screen over the user's own memberships; no API of its own
      expect([m.key, moduleForPath(paths[m.key])]).toEqual([m.key, m.key]);
    }
    expect(moduleForPath('/api/policies')).toBeNull();
    expect(moduleForPath('/api/reports/export/pdf')).toBeNull(); // basic reports: every plan
    for (const dir of ['risks', 'audits', 'approvals', 'training', 'incidents', 'analytics', 'signatures', 'vendors', 'escalations', 'integrations', 'ai', 'privacy', 'policies', 'reports']) {
      const file = fs.readdirSync(path.join(backendDir, 'src/modules', dir)).find((f) => f.endsWith('.router.ts') && !f.includes('room'))!;
      expect([dir, /router\.use\(.*enforceEntitlement\(\)/.test(fs.readFileSync(path.join(backendDir, 'src/modules', dir, file), 'utf8'))]).toEqual([dir, true]);
    }
  });
});
