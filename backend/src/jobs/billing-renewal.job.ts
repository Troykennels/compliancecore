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
      `UPDATE global.subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
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

  // Advance period
  const { advancePeriod, calcBasePrice, applyDiscount } = await import('../modules/billing/billing.service');
  const cycle = row.billing_cycle as 'monthly' | 'yearly';
  const newStart = new Date(row.current_period_end);
  const newEnd = advancePeriod(newStart, cycle);
  const dueDate = new Date(newStart.getTime() + 7 * 86400_000);

  const basePlan = { priceMonthly: Number(row.price_monthly), priceYearly: Number(row.price_yearly) } as Parameters<typeof calcBasePrice>[0];
  const basePrice = calcBasePrice(basePlan, cycle);
  const nextAmount = applyDiscount(basePrice, Number(row.discount_percent), Number(row.discount_fixed));

  // Create invoice
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

  // Advance subscription period
  await prisma.$executeRawUnsafe(`
    UPDATE global.subscriptions
    SET status = 'active', current_period_start = $1, current_period_end = $2,
        next_invoice_amount = $3, updated_at = NOW()
    WHERE id = $4
  `, newStart, newEnd, nextAmount, row.id);

  logger.info({ subscriptionId: row.id, invoiceId: inv.id, tenant: row.tenant_name, amount: nextAmount }, 'Subscription renewed');

  if (nextAmount > 0) {
    try {
      const ownerEmail = await getTenantOwnerEmail(row.tenant_id);
      await emailClient.sendRawEmail({
        to: ownerEmail,
        subject: `Invoice ${inv.number} — ComplianceCore`,
        html: `
          <h2>New Invoice: ${inv.number}</h2>
          <p>A new invoice has been generated for your <strong>${row.plan_name}</strong> subscription for <strong>${row.tenant_name}</strong>.</p>
          <table style="border-collapse:collapse;width:100%">
            <tr><td><strong>Billing Period</strong></td><td>${newStart.toLocaleDateString('en-GB')} – ${newEnd.toLocaleDateString('en-GB')}</td></tr>
            <tr><td><strong>Amount Due</strong></td><td>${row.currency} ${nextAmount.toFixed(2)}</td></tr>
            <tr><td><strong>Due Date</strong></td><td>${dueDate.toLocaleDateString('en-GB')}</td></tr>
          </table>
          <p>Log in to your ComplianceCore account to download this invoice.</p>
          <p>Questions? Contact <a href="mailto:billing@orionsoft.com">billing@orionsoft.com</a></p>
        `,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send invoice email');
    }
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

async function processRenewals(): Promise<void> {
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
