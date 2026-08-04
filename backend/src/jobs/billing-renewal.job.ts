import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../lib/logger';
import { email as emailClient } from '../lib/email';

const QUEUE_NAME = 'billing-renewal';

export const billingRenewalQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
});

export async function scheduleBillingRenewalJob(): Promise<void> {
  await billingRenewalQueue.add(
    'process-renewals',
    {},
    {
      jobId: 'billing-renewal-daily',
      repeat: { pattern: '0 2 * * *' }, // 02:00 UTC daily
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );
}

interface DueRow {
  id: string;
  tenant_id: string;
  schema_name: string;
  tenant_name: string;
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  billing_cycle: string;
  cancel_at_period_end: boolean;
  current_period_start: Date;
  current_period_end: Date;
  coupon_id: string | null;
  discount_percent: number;
  discount_fixed: number;
  currency: string;
  price_monthly: number;
  price_yearly: number;
}

async function processDueSubscription(row: DueRow): Promise<void> {
  const { findDueSubscriptions: _, ...repo } = await import('../modules/billing/billing.repository');
  void _;

  if (row.cancel_at_period_end) {
    // Mark cancelled
    await prisma.$executeRawUnsafe(
      `UPDATE global.subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
      row.id,
    );
    logger.info({ subscriptionId: row.id, tenant: row.tenant_name }, 'Subscription cancelled at period end');

    try {
      await emailClient.sendRawEmail({
        to: await getTenantOwnerEmail(row.tenant_id),
        subject: `Your ComplianceCore subscription has been cancelled`,
        html: `
          <h2>Subscription Cancelled</h2>
          <p>Your <strong>${row.plan_name}</strong> subscription for <strong>${row.tenant_name}</strong> has been cancelled as requested.</p>
          <p>You had access until ${new Date(row.current_period_end).toLocaleDateString('en-GB')}.</p>
          <p>To reactivate, please visit your billing settings or contact <a href="mailto:billing@orionsoft.com">billing@orionsoft.com</a>.</p>
        `,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send cancellation email');
    }
    return;
  }

  const { advancePeriod, calcBasePrice, applyDiscount } = await import('../modules/billing/billing.service');
  const cycle = row.billing_cycle as 'monthly' | 'yearly';
  const newStart = new Date(row.current_period_end);
  const newEnd = advancePeriod(newStart, cycle);
  const dueDate = new Date(newStart.getTime() + 7 * 86400_000);

  const basePlan = { priceMonthly: Number(row.price_monthly), priceYearly: Number(row.price_yearly) } as Parameters<typeof calcBasePrice>[0];
  const basePrice = calcBasePrice(basePlan, cycle);
  const nextAmount = applyDiscount(basePrice, Number(row.discount_percent), Number(row.discount_fixed));

  const inv = await repo.createInvoice({
    tenantId: row.tenant_id,
    subscriptionId: row.id,
    amountDue: nextAmount,
    currency: row.currency,
    billingPeriodStart: newStart,
    billingPeriodEnd: newEnd,
    dueDate,
    lineItems: [{
      description: `${row.plan_name} — ${cycle} subscription`,
      quantity: 1,
      unitAmount: nextAmount,
      amount: nextAmount,
    }],
  });

  // A free plan has nothing to collect, so it simply rolls forward.
  if (nextAmount <= 0) {
    await advanceSubscription(row.id, newStart, newEnd, nextAmount);
    await repo.markInvoicePaid(inv.id, 0, new Date());
    logger.info({ subscriptionId: row.id, tenant: row.tenant_name }, 'Free subscription rolled forward');
    return;
  }

  // ── Actually take the money ────────────────────────────────────────────────
  //
  // This job used to advance the period and set status='active' unconditionally
  // while only writing an invoice nobody collected. Entitlements key off
  // current_period_end, so a customer paid once at checkout and then held the
  // plan forever — every month the job silently extended their access and
  // logged "Subscription renewed" against a charge that never happened.
  //
  // The period is now only extended when a charge succeeds.
  const ownerEmail = await getTenantOwnerEmail(row.tenant_id);
  const outcome = await chargeForRenewal({
    tenantId: row.tenant_id,
    invoiceId: inv.id,
    amount: nextAmount,
    currency: row.currency,
    planName: row.plan_name,
    planId: row.plan_id,
    cycle,
  });

  if (outcome.status === 'paid') {
    await advanceSubscription(row.id, newStart, newEnd, nextAmount);
    await repo.markInvoicePaid(inv.id, nextAmount, outcome.paidAt);
    logger.info(
      { subscriptionId: row.id, invoiceId: inv.id, tenant: row.tenant_name, amount: nextAmount },
      'Subscription renewed and charged',
    );
    await sendRenewalEmail(ownerEmail, {
      subject: `Payment received — ${inv.number}`,
      heading: 'Subscription renewed',
      body: `
        <p>We've renewed your <strong>${row.plan_name}</strong> subscription for <strong>${row.tenant_name}</strong> and charged your saved payment method.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td><strong>Billing Period</strong></td><td>${newStart.toLocaleDateString('en-GB')} – ${newEnd.toLocaleDateString('en-GB')}</td></tr>
          <tr><td><strong>Amount Paid</strong></td><td>${row.currency} ${nextAmount.toFixed(2)}</td></tr>
          <tr><td><strong>Invoice</strong></td><td>${inv.number}</td></tr>
        </table>
        <p>No action is needed. You can download the receipt from your billing settings.</p>`,
    });
    return;
  }

  // Not collected. The period deliberately stays where it is, so the
  // entitlement model's grace window starts from the date already paid for —
  // seven days of full access with a prompt, then read-only. Reads are never
  // blocked: this is compliance evidence, and locking someone out of their own
  // audit records over a failed card is worse than the leverage it buys.
  await prisma.$executeRawUnsafe(
    `UPDATE global.subscriptions SET status = 'past_due', next_invoice_amount = $1, updated_at = NOW() WHERE id = $2::uuid`,
    nextAmount, row.id,
  );

  logger.warn(
    { subscriptionId: row.id, invoiceId: inv.id, tenant: row.tenant_name, reason: outcome.reason },
    'Renewal not collected — subscription marked past_due',
  );

  await sendRenewalEmail(ownerEmail, {
    subject: `Action needed: we couldn't renew your subscription`,
    heading: "We couldn't take payment",
    body: `
      <p>We tried to renew your <strong>${row.plan_name}</strong> subscription for <strong>${row.tenant_name}</strong> but the payment did not go through.</p>
      <p style="color:#4B5568">${outcome.reason}</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td><strong>Amount Due</strong></td><td>${row.currency} ${nextAmount.toFixed(2)}</td></tr>
        <tr><td><strong>Invoice</strong></td><td>${inv.number}</td></tr>
      </table>
      <p><strong>Your access continues for the next 7 days.</strong> Please update your payment method in billing settings to avoid interruption. After that your account becomes read-only — you will always keep access to your compliance records.</p>
      <p>Questions? Contact <a href="mailto:billing@orionsoft.com">billing@orionsoft.com</a></p>`,
  });
}

async function advanceSubscription(
  subscriptionId: string, start: Date, end: Date, nextAmount: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscriptions
    SET status = 'active', current_period_start = $1::timestamptz, current_period_end = $2::timestamptz,
        next_invoice_amount = $3, updated_at = NOW()
    WHERE id = $4::uuid
  `, start, end, nextAmount, subscriptionId);
}

type ChargeOutcome =
  | { status: 'paid'; paidAt: Date }
  | { status: 'unpaid'; reason: string };

/**
 * Charges the tenant's stored card for a renewal.
 *
 * Every failure mode is deliberately non-throwing and returns a reason, so one
 * declined card cannot abort the nightly run for everyone behind it.
 */
async function chargeForRenewal(input: {
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  planName: string;
  planId: string;
  cycle: 'monthly' | 'yearly';
}): Promise<ChargeOutcome> {
  const { isPaystackConfigured, chargeAuthorization } = await import('../modules/payments/paystack.client');
  const paymentsRepo = await import('../modules/payments/payments.repository');
  const repo = await import('../modules/billing/billing.repository');

  if (!isPaystackConfigured()) {
    return { status: 'unpaid', reason: 'Payments are not configured on this deployment.' };
  }

  const auth = await repo.findChargeableAuthorization(input.tenantId);
  if (!auth) {
    return {
      status: 'unpaid',
      reason: 'No saved payment method. The card used at checkout could not be stored for reuse.',
    };
  }

  // Recorded before the call, so a charge that succeeds at Paystack but fails
  // to return to us is still reconcilable from the reference rather than lost.
  const reference = `CCR-${input.tenantId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
  await paymentsRepo.createTransaction({
    reference,
    tenantId: input.tenantId,
    userId: null,
    planId: input.planId,
    billingCycle: input.cycle,
    currency: input.currency,
    amount: input.amount,
  });

  try {
    const result = await chargeAuthorization({
      authorizationCode: auth.authorizationCode,
      email: auth.email,
      amountMajor: input.amount,
      currency: input.currency,
      reference,
      metadata: { tenantId: input.tenantId, invoiceId: input.invoiceId, kind: 'renewal' },
    });

    // A declined card comes back as HTTP 200 with status 'failed', so the body
    // has to be inspected — a non-throwing call is not proof of payment.
    if (result.status !== 'success') {
      await paymentsRepo.markTransactionFailed(reference, 'failed', result.gateway_response ?? result.status);
      return { status: 'unpaid', reason: result.gateway_response ?? 'The payment was declined.' };
    }

    const paidAt = result.paid_at ? new Date(result.paid_at) : new Date();
    await paymentsRepo.claimTransaction(reference, result.reference ?? reference, paidAt);
    return { status: 'paid', paidAt };
  } catch (err) {
    // Provider unreachable or erroring — our problem, not the customer's, but
    // the outcome is the same: nothing was collected, so nothing is granted.
    // The job runs again tomorrow and BullMQ retries this run three times.
    await paymentsRepo.markTransactionFailed(reference, 'failed', (err as Error).message).catch(() => {});
    logger.error({ err, tenantId: input.tenantId }, 'Renewal charge failed at the provider');
    return { status: 'unpaid', reason: 'We could not reach the payment provider.' };
  }
}

async function sendRenewalEmail(
  to: string,
  content: { subject: string; heading: string; body: string },
): Promise<void> {
  if (!to) return;
  try {
    await emailClient.sendRawEmail({
      to,
      subject: `${content.subject} — ComplianceCore`,
      html: `<h2>${content.heading}</h2>${content.body}`,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to send renewal email');
  }
}

async function getTenantOwnerEmail(tenantId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT u.email
    FROM global.users u
    JOIN global.tenant_memberships m ON m.user_id = u.id
    WHERE m.tenant_id = ${tenantId}::uuid
      AND m.role = 'owner'
      AND m.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.email ?? '';
}

/** Exported so the renewal path can be tested without a scheduler or Redis. */
export async function processRenewals(): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() + 24); // subscriptions ending within 24h

  const { findDueSubscriptions } = await import('../modules/billing/billing.repository');
  const due = await findDueSubscriptions(cutoff);

  logger.info({ count: due.length }, 'Processing due billing renewals');

  for (const row of due) {
    try {
      await processDueSubscription(row as unknown as DueRow);
    } catch (err) {
      logger.error({ err, subscriptionId: row.id }, 'Failed to process renewal');
    }
  }
}

export function startBillingRenewalWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await processRenewals();
    },
    { connection: redisForQueues, concurrency: 1 },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Billing renewal job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Billing renewal job failed');
  });

  return worker;
}
