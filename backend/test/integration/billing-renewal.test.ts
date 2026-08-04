import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

/**
 * The renewal path, against a live Postgres with the payment provider stubbed.
 *
 * This exists because the job used to advance the billing period and set
 * status='active' while only writing an invoice nobody collected — no charge
 * was ever attempted. Entitlements key off current_period_end, so a customer
 * paid once at checkout and then held the plan free forever, with the log
 * cheerfully reporting "Subscription renewed" each month.
 *
 * The three cases below are the ones that matter commercially:
 *   - a successful charge extends the period and settles the invoice;
 *   - a declined card does NOT extend it;
 *   - no stored card does NOT extend it.
 *
 * The middle two are the point. A test that only covers the happy path would
 * stay green while the product gave itself away.
 */

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');

// Controlled per test, so one stub covers success, decline and provider error.
const chargeStub = vi.fn();

vi.mock('../../src/modules/payments/paystack.client', () => ({
  isPaystackConfigured: () => true,
  chargeAuthorization: (...args: unknown[]) => chargeStub(...args),
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
  verifyWebhookSignature: () => false,
}));

// The job pulls email in at module scope; nothing here should try to send.
vi.mock('../../src/lib/email', () => ({
  email: { sendRawEmail: vi.fn().mockResolvedValue(undefined) },
}));

describe.skipIf(!TEST_DB)('billing renewal collects payment', () => {
  let client: pg.Client;
  let tenantId: string;
  let planId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();

    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: TEST_DB } });

    // Billing tables are created at boot, not by the migration runner.
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository');
    await initBillingTables();

    const plan = await client.query(
      `SELECT id FROM global.subscription_plans WHERE slug = 'professional'`,
    );
    planId = plan.rows[0].id;
  }, 120_000);

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    chargeStub.mockReset();
    await client.query(`DELETE FROM global.payment_transactions`);
    await client.query(`DELETE FROM global.invoices`);
    await client.query(`DELETE FROM global.payment_methods`);
    await client.query(`DELETE FROM global.subscriptions`);
    await client.query(`DELETE FROM global.tenants WHERE slug LIKE 'renewal-%'`);

    const t = await client.query(
      // updated_at has no default on this table, so it is set explicitly.
      `INSERT INTO global.tenants (name, slug, schema_name, updated_at)
       VALUES ('Renewal Co', 'renewal-' || substr(md5(random()::text), 1, 8), 'tenant_' || repeat('c', 32), NOW())
       RETURNING id`,
    );
    tenantId = t.rows[0].id;

    // A paid subscription whose period ends within the job's 24h window.
    await client.query(
      `INSERT INTO global.subscriptions
         (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end,
          next_invoice_amount, currency)
       VALUES ($1::uuid, $2::uuid, 'active', 'monthly',
               NOW() - interval '30 days', NOW() + interval '2 hours', 85000, 'NGN')`,
      [tenantId, planId],
    );
  });

  async function runRenewal() {
    const { processRenewals } = await import('../../src/jobs/billing-renewal.job');
    await processRenewals();
  }

  async function saveCard() {
    await client.query(
      `INSERT INTO global.payment_methods
         (tenant_id, type, label, last4, provider, authorization_code, authorization_email,
          is_reusable, is_default, is_active)
       VALUES ($1::uuid, 'card', 'Visa •••• 4081', '4081', 'paystack', 'AUTH_test123',
               'payer@example.com', true, true, true)`,
      [tenantId],
    );
  }

  async function subscription() {
    const r = await client.query(
      `SELECT status, current_period_end FROM global.subscriptions WHERE tenant_id = $1::uuid`,
      [tenantId],
    );
    return r.rows[0];
  }

  it('charges the stored card and extends the period', async () => {
    await saveCard();
    chargeStub.mockResolvedValue({
      status: 'success',
      reference: 'PSTK_ok',
      amount: 8_500_000,
      currency: 'NGN',
      paid_at: new Date().toISOString(),
      gateway_response: 'Approved',
    });

    const before = await subscription();
    await runRenewal();
    const after = await subscription();

    expect(chargeStub).toHaveBeenCalledTimes(1);
    // Paystack takes the smallest unit: ₦85,000 must go out as 8,500,000 kobo.
    expect(chargeStub.mock.calls[0][0]).toMatchObject({
      authorizationCode: 'AUTH_test123',
      email: 'payer@example.com',
      amountMajor: 85000,
      currency: 'NGN',
    });
    expect(after.status).toBe('active');
    expect(new Date(after.current_period_end).getTime())
      .toBeGreaterThan(new Date(before.current_period_end).getTime());

    const inv = await client.query(
      `SELECT status, amount_paid, paid_at FROM global.invoices WHERE tenant_id = $1::uuid`,
      [tenantId],
    );
    expect(inv.rows[0].status).toBe('paid');
    expect(Number(inv.rows[0].amount_paid)).toBe(85000);
    expect(inv.rows[0].paid_at).not.toBeNull();
  }, 60_000);

  it('does NOT extend the period when the card is declined', async () => {
    await saveCard();
    chargeStub.mockResolvedValue({
      status: 'failed',
      reference: 'PSTK_declined',
      amount: 8_500_000,
      currency: 'NGN',
      paid_at: null,
      gateway_response: 'Insufficient funds',
    });

    const before = await subscription();
    await runRenewal();
    const after = await subscription();

    expect(after.status).toBe('past_due');
    // The exact regression: access must not be extended by an uncollected charge.
    expect(new Date(after.current_period_end).getTime())
      .toBe(new Date(before.current_period_end).getTime());

    const inv = await client.query(
      `SELECT status, amount_paid FROM global.invoices WHERE tenant_id = $1::uuid`,
      [tenantId],
    );
    expect(inv.rows[0].status).not.toBe('paid');
    expect(Number(inv.rows[0].amount_paid)).toBe(0);

    const tx = await client.query(
      `SELECT status, failure_reason FROM global.payment_transactions WHERE tenant_id = $1::uuid`,
      [tenantId],
    );
    expect(tx.rows[0].status).toBe('failed');
    expect(tx.rows[0].failure_reason).toContain('Insufficient funds');
  }, 60_000);

  it('does NOT extend the period when there is no stored card', async () => {
    const before = await subscription();
    await runRenewal();
    const after = await subscription();

    expect(chargeStub).not.toHaveBeenCalled();
    expect(after.status).toBe('past_due');
    expect(new Date(after.current_period_end).getTime())
      .toBe(new Date(before.current_period_end).getTime());
  }, 60_000);

  it('rolls a zero-priced plan forward without charging', async () => {
    await client.query(`UPDATE global.subscription_plans SET price_monthly = 0 WHERE id = $1::uuid`, [planId]);
    try {
      const before = await subscription();
      await runRenewal();
      const after = await subscription();

      expect(chargeStub).not.toHaveBeenCalled();
      expect(after.status).toBe('active');
      expect(new Date(after.current_period_end).getTime())
        .toBeGreaterThan(new Date(before.current_period_end).getTime());
    } finally {
      await client.query(`UPDATE global.subscription_plans SET price_monthly = 85000 WHERE id = $1::uuid`, [planId]);
    }
  }, 60_000);
});
