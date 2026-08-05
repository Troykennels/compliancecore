import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

/**
 * Pre-expiry warnings, against a live Postgres with email stubbed.
 *
 * The behaviour that matters commercially is that a customer is warned ONCE per
 * threshold. A daily job that re-sends the same "3 days left" email every
 * morning is worse than no email: it trains people to ignore the one message
 * they need to act on.
 */

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');

const sendRawEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/email', () => ({ email: { sendRawEmail: (...a: unknown[]) => sendRawEmail(...a) } }));

describe.skipIf(!TEST_DB)('subscription expiry reminders', () => {
  let client: pg.Client;
  let tenantId: string;
  let planId: string;
  let subId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: TEST_DB } });
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository');
    await initBillingTables();
    planId = (await client.query(`SELECT id FROM global.subscription_plans WHERE slug='professional'`)).rows[0].id;
  }, 120_000);

  afterAll(async () => { await client?.end(); });

  beforeEach(async () => {
    sendRawEmail.mockClear();
    await client.query(`DELETE FROM global.subscription_reminders`);
    await client.query(`DELETE FROM global.payment_methods`);
    await client.query(`DELETE FROM global.subscriptions`);
    await client.query(`DELETE FROM global.tenant_memberships`);
    await client.query(`DELETE FROM global.users WHERE email LIKE 'owner-%'`);
    await client.query(`DELETE FROM global.tenants WHERE slug LIKE 'rem-%'`);

    tenantId = (await client.query(
      `INSERT INTO global.tenants (name, slug, schema_name, updated_at)
       VALUES ('Reminder Co', 'rem-' || substr(md5(random()::text),1,8), 'tenant_' || repeat('d',32), NOW())
       RETURNING id`)).rows[0].id;

    const userId = (await client.query(
      `INSERT INTO global.users (email, password_hash, first_name, last_name, updated_at)
       VALUES ('owner-' || substr(md5(random()::text),1,8) || '@example.com', 'x', 'Owner', 'One', NOW())
       RETURNING id`)).rows[0].id;
    await client.query(
      `INSERT INTO global.tenant_memberships (tenant_id, user_id, role)
       VALUES ($1::uuid, $2::uuid, 'owner')`, [tenantId, userId]);
  });

  async function makeSubscription(opts: { status: string; daysOut: number; trial?: boolean }) {
    const endExpr = `NOW() + interval '${opts.daysOut} days'`;
    subId = (await client.query(
      `INSERT INTO global.subscriptions
         (tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end,
          trial_ends_at, next_invoice_amount, currency)
       VALUES ($1::uuid, $2::uuid, $3, 'monthly', NOW() - interval '20 days', ${endExpr},
               ${opts.trial ? endExpr : 'NULL'}, 85000, 'NGN')
       RETURNING id`, [tenantId, planId, opts.status])).rows[0].id;
    return subId;
  }

  async function run() {
    const { sendExpiryReminders } = await import('../../src/jobs/subscription-reminder.job');
    await sendExpiryReminders();
  }

  it('warns once per threshold, not every day', async () => {
    await makeSubscription({ status: 'trial', daysOut: 3, trial: true });

    await run();
    expect(sendRawEmail).toHaveBeenCalledTimes(1);

    // The job runs daily. Nothing about the subscription has changed, so the
    // same warning must not go out again.
    await run();
    await run();
    expect(sendRawEmail).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('sends a fresh warning as each threshold is crossed', async () => {
    // 6 days, not 7: a subscription sitting exactly on the window boundary is
    // decided by microseconds between the INSERT and the query, which makes the
    // test flaky without testing anything real. What matters is that a later
    // band fires after an earlier one already has.
    await makeSubscription({ status: 'trial', daysOut: 6, trial: true });
    await run();
    expect(sendRawEmail).toHaveBeenCalledTimes(1);
    expect(sendRawEmail.mock.calls[0][0].subject).toContain('in 6 days');

    // Move the clock forward by pulling the expiry closer.
    await client.query(
      `UPDATE global.subscriptions SET trial_ends_at = NOW() + interval '1 day',
              current_period_end = NOW() + interval '1 day' WHERE id = $1::uuid`, [subId]);
    await run();
    expect(sendRawEmail).toHaveBeenCalledTimes(2);
    expect(sendRawEmail.mock.calls[1][0].subject).toContain('tomorrow');
  }, 60_000);

  it('tells a trial to choose a plan', async () => {
    await makeSubscription({ status: 'trial', daysOut: 3, trial: true });
    await run();
    const { subject, html } = sendRawEmail.mock.calls[0][0];
    expect(subject).toContain('trial ends');
    expect(html).toContain('Choose a plan');
  }, 60_000);

  it('tells a paying customer with a card what will be charged', async () => {
    await makeSubscription({ status: 'active', daysOut: 3 });
    await client.query(
      `INSERT INTO global.payment_methods
         (tenant_id, type, label, provider, authorization_code, authorization_email,
          is_reusable, is_default, is_active)
       VALUES ($1::uuid,'card','Visa','paystack','AUTH_x','p@e.com',true,true,true)`, [tenantId]);

    await run();
    const { subject, html } = sendRawEmail.mock.calls[0][0];
    expect(subject).toContain('renews');
    // The amount and date must be stated: charging without warning is how a
    // renewal turns into a chargeback.
    expect(html).toContain('NGN 85,000.00');
  }, 60_000);

  it('warns a paying customer with NO card that access will stop', async () => {
    await makeSubscription({ status: 'active', daysOut: 3 });
    await run();
    const { subject, html } = sendRawEmail.mock.calls[0][0];
    expect(subject).toContain('Action needed');
    expect(html).toContain('no saved payment method');
  }, 60_000);

  it('ignores subscriptions that are not near expiry, or already cancelled', async () => {
    await makeSubscription({ status: 'active', daysOut: 20 });
    await run();
    expect(sendRawEmail).not.toHaveBeenCalled();

    await client.query(
      `UPDATE global.subscriptions SET current_period_end = NOW() + interval '2 days',
              cancel_at_period_end = true WHERE id = $1::uuid`, [subId]);
    await run();
    // Someone who has already chosen to leave should not be nagged to renew.
    expect(sendRawEmail).not.toHaveBeenCalled();
  }, 60_000);
});
