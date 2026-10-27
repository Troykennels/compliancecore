import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

/**
 * Paying an open invoice in parts, against a live Postgres with Paystack stubbed.
 *
 * A renewal that wasn't collected leaves one open invoice. Every payment
 * towards it, full or part, must land on that same invoice until the balance
 * is zero; only then is the billing period granted. A part-paid invoice must
 * never be overwritten or duplicated by a plan checkout, and the automatic
 * renewal must never charge its full amount again.
 */

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');

const initStub = vi.fn();
const verifyStub = vi.fn();
const chargeStub = vi.fn();
vi.mock('bullmq', () => ({ Queue: class {}, Worker: class {} }));
vi.mock('../../src/config/redis', () => ({ redisForQueues: {} }));
vi.mock('../../src/modules/payments/paystack.client', () => ({
  isPaystackConfigured: () => true,
  chargeAuthorization: (...args: unknown[]) => chargeStub(...args),
  initializeTransaction: (...args: unknown[]) => initStub(...args),
  verifyTransaction: (...args: unknown[]) => verifyStub(...args),
  verifyWebhookSignature: () => false,
}));
vi.mock('../../src/lib/email', () => ({ email: { sendRawEmail: vi.fn().mockResolvedValue(undefined) } }));

describe.skipIf(!TEST_DB)('invoice part-payments complete the same invoice', () => {
  let client: pg.Client;
  let tenantId: string;
  let planId: string;
  let userId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const target = new URL(TEST_DB!);
    if (target.hostname !== '127.0.0.1' || !target.pathname.startsWith('/compliance_renewal_task_')) throw Error('Dedicated local disposable database required');
    process.env.DATABASE_URL = TEST_DB;
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: TEST_DB } });
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository');
    await initBillingTables();
    planId = (await client.query(`SELECT id FROM global.subscription_plans WHERE slug = 'professional'`)).rows[0].id;
  }, 120_000);

  afterAll(async () => {
    const { prisma } = await import('../../src/config/database');
    await prisma.$disconnect();
    await client?.end();
  });

  beforeEach(async () => {
    initStub.mockReset(); verifyStub.mockReset(); chargeStub.mockReset();
    initStub.mockImplementation(async (input: { reference: string }) => ({ authorization_url: `https://checkout.paystack.com/${input.reference}`, reference: input.reference }));
    // Paystack reports exactly what checkout asked for.
    verifyStub.mockImplementation(async (reference: string) => {
      const sent = initStub.mock.calls.find((c) => c[0].reference === reference)?.[0];
      return { status: 'success', reference, amount: Math.round(sent.amountMajor * 100), currency: sent.currency, paid_at: new Date().toISOString(), customer: { email: sent.email }, authorization: null };
    });
    for (const t of ['payment_transactions', 'invoices', 'recurring_consents', 'renewal_attempts', 'subscriptions']) await client.query(`DELETE FROM global.${t}`).catch(() => {});
    await client.query(`DELETE FROM global.tenants WHERE slug LIKE 'partpay-%'`);
    tenantId = (await client.query(`INSERT INTO global.tenants (name, slug, schema_name, updated_at)
      VALUES ('PartPay Co', 'partpay-' || substr(md5(random()::text), 1, 8), 'tenant_' || repeat('d', 32), NOW()) RETURNING id`)).rows[0].id;
    await client.query(`INSERT INTO global.tenant_onboarding(tenant_id,status) VALUES($1,'grandfathered') ON CONFLICT DO NOTHING`, [tenantId]);
    userId = (await client.query(`INSERT INTO global.users (email, password_hash, first_name, last_name, updated_at)
      VALUES ('payer-' || substr(md5(random()::text),1,8) || '@example.com', 'x', 'Pay', 'Er', NOW()) RETURNING id`)).rows[0].id;
    // Period ended two hours ago; no saved card, so the renewal job leaves an open invoice.
    await client.query(`INSERT INTO global.subscriptions (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end, next_invoice_amount, currency)
      VALUES ($1::uuid, $2::uuid, 'active', 'monthly', NOW() - interval '30 days', NOW() - interval '2 hours', 85000, 'NGN')`, [tenantId, planId]);
    const { processRenewals } = await import('../../src/jobs/billing-renewal.job');
    await processRenewals();
    const inv = await client.query(`SELECT id, status, amount_due FROM global.invoices WHERE tenant_id=$1::uuid`, [tenantId]);
    expect(inv.rows).toHaveLength(1);
    expect(inv.rows[0].status).toBe('open');
    invoiceId = inv.rows[0].id;
  }, 60_000);

  async function pay(amount?: number) {
    const { createInvoiceCheckout } = await import('../../src/modules/payments/invoice-checkout');
    const started = await createInvoiceCheckout({ tenantId, userId, email: 'payer@example.com', invoiceId, amount });
    const { confirmByReference } = await import('../../src/modules/payments/payments.service');
    return { started, confirmed: await confirmByReference(tenantId, started.reference) };
  }
  const invoice = async () => (await client.query(`SELECT * FROM global.invoices WHERE id=$1::uuid`, [invoiceId])).rows[0];
  const sub = async () => (await client.query(`SELECT * FROM global.subscriptions WHERE tenant_id=$1::uuid`, [tenantId])).rows[0];

  it('takes part-payments on the same invoice and grants the period once paid off', async () => {
    const before = await sub();
    const first = await pay(30000);
    expect(first.started.amount).toBe(30000);
    expect(initStub.mock.calls[0][0]).toMatchObject({ amountMajor: 30000, currency: 'NGN' });
    expect(first.confirmed.status).toBe('success');
    let inv = await invoice();
    expect(Number(inv.amount_paid)).toBe(30000);
    expect(inv.status).toBe('open');
    // Not paid off yet: the period is not granted.
    expect(+new Date((await sub()).current_period_end)).toBe(+new Date(before.current_period_end));

    // A plan checkout can't replace or overwrite the part-paid invoice.
    const { createCheckout } = await import('../../src/modules/payments/payments.service');
    await expect(createCheckout({ tenantId, userId, email: 'payer@example.com', planId, currency: 'NGN', billingCycle: 'monthly' }))
      .rejects.toMatchObject({ code: 'OPEN_INVOICE_BALANCE' });

    // The rest (no amount = the whole balance).
    const second = await pay();
    expect(second.started.amount).toBe(55000);
    inv = await invoice();
    expect(Number(inv.amount_paid)).toBe(85000);
    expect(inv.status).toBe('paid');
    expect(inv.paid_at).not.toBeNull();
    expect(inv.metadata.payments).toHaveLength(2);
    const after = await sub();
    expect(after.status).toBe('active');
    expect(+new Date(after.current_period_end)).toBeGreaterThan(+new Date(before.current_period_end));
    expect((await client.query(`SELECT count(*)::int n FROM global.invoices WHERE tenant_id=$1::uuid`, [tenantId])).rows[0].n).toBe(1);

    // Nothing left to pay.
    const { createInvoiceCheckout } = await import('../../src/modules/payments/invoice-checkout');
    await expect(createInvoiceCheckout({ tenantId, userId, email: 'payer@example.com', invoiceId })).rejects.toThrow(/nothing left/);
  }, 60_000);

  it('rejects amounts above the balance or below the minimum, and other tenants', async () => {
    const { createInvoiceCheckout } = await import('../../src/modules/payments/invoice-checkout');
    await expect(createInvoiceCheckout({ tenantId, userId, email: 'p@example.com', invoiceId, amount: 85000.01 })).rejects.toThrow(/balance/);
    await expect(createInvoiceCheckout({ tenantId, userId, email: 'p@example.com', invoiceId, amount: 50 })).rejects.toThrow(/smallest/);
    const other = (await client.query(`INSERT INTO global.tenants (name, slug, schema_name, updated_at)
      VALUES ('Other', 'partpay-' || substr(md5(random()::text), 1, 8), 'tenant_' || repeat('e', 32), NOW()) RETURNING id`)).rows[0].id;
    await expect(createInvoiceCheckout({ tenantId: other, userId, email: 'p@example.com', invoiceId })).rejects.toThrow(/not found/i);
    // A double-click reuses the same checkout.
    const a = await createInvoiceCheckout({ tenantId, userId, email: 'p@example.com', invoiceId, amount: 1000 });
    const b = await createInvoiceCheckout({ tenantId, userId, email: 'p@example.com', invoiceId, amount: 1000 });
    expect(b.reference).toBe(a.reference);
  });

  it('records a payment once when webhook and return page race', async () => {
    const { createInvoiceCheckout } = await import('../../src/modules/payments/invoice-checkout');
    const { confirmByReference } = await import('../../src/modules/payments/payments.service');
    const started = await createInvoiceCheckout({ tenantId, userId, email: 'payer@example.com', invoiceId, amount: 20000 });
    await Promise.all([1, 2, 3].map(() => confirmByReference(tenantId, started.reference)));
    expect(Number((await invoice()).amount_paid)).toBe(20000);
  });

  it('never charges the full renewal again on a part-paid invoice', async () => {
    await pay(10000);
    const { collectRenewal } = await import('../../src/modules/payments/recurring.service');
    const s = await sub();
    const outcome = await collectRenewal({ tenantId, subscriptionId: s.id, periodEnd: s.current_period_end, invoiceId, amount: 85000, currency: 'NGN', planId, cycle: 'monthly' });
    expect(outcome).toMatchObject({ status: 'unpaid' });
    expect(chargeStub).not.toHaveBeenCalled();
  });

  it('holds money that arrives after the invoice was settled another way', async () => {
    const { createInvoiceCheckout } = await import('../../src/modules/payments/invoice-checkout');
    const { confirmByReference } = await import('../../src/modules/payments/payments.service');
    const started = await createInvoiceCheckout({ tenantId, userId, email: 'payer@example.com', invoiceId });
    await client.query(`UPDATE global.invoices SET status='paid', amount_paid=amount_due, paid_at=now() WHERE id=$1::uuid`, [invoiceId]);
    const result = await confirmByReference(tenantId, started.reference);
    expect(result).toMatchObject({ status: 'success', review: true });
    expect(Number((await invoice()).amount_paid)).toBe(85000);
    const tx = (await client.query(`SELECT status, failure_reason FROM global.payment_transactions WHERE reference=$1`, [started.reference])).rows[0];
    expect(tx.status).toBe('success');
    expect(tx.failure_reason).toMatch(/review/i);
  });
});
