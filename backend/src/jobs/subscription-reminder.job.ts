import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { logger } from '../lib/logger';
import { email as emailClient } from '../lib/email';
import { env } from '../config/env';
import { SUPPORT_EMAIL } from '../config/contact';
import * as billingRepo from '../modules/billing/billing.repository';

/**
 * Warns an organisation before its trial or subscription ends.
 *
 * Until now the only billing email went out AFTER a charge failed, and the
 * in-app banner only appears in the last five days — so a customer who was not
 * logged in that week got no warning at all. The first they knew was the
 * product going read-only, which is both a bad experience and the most
 * expensive possible moment to try to save the subscription.
 *
 * Three warnings, once each, at 7 / 3 / 1 days. The dedupe is a unique
 * constraint keyed on (subscription, period end, threshold), so re-running the
 * job — or two workers racing — cannot send twice, and a renewal that moves the
 * period end naturally starts a fresh set for the new period.
 */

const QUEUE_NAME = 'subscription-reminder';

// ASCENDING, and it matters. Written descending as [7, 3, 1], `find(t => days
// <= t)` returns the first match — which is 7 for anything a week out or less.
// Every customer would have received exactly one email, labelled "7 days",
// however close they actually were, and the 3-day and 1-day warnings would
// never have fired at all.
const THRESHOLDS = [1, 3, 7] as const;
const MAX_THRESHOLD = THRESHOLDS[THRESHOLDS.length - 1];

export const subscriptionReminderQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
});

export async function scheduleSubscriptionReminderJob(): Promise<void> {
  await subscriptionReminderQueue.add(
    'send-expiry-reminders',
    {},
    {
      jobId: 'subscription-reminder-daily',
      // 08:00 UTC — 9am in Lagos. A billing warning that lands at 2am is read
      // late or not at all, and these have a deadline attached.
      repeat: { pattern: '0 8 * * *' },
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );
}

const DAY_MS = 86_400_000;

/**
 * The tightest warning band this expiry falls into, plus the true days left.
 *
 * The band is only for deduplication — the copy uses the real number, so a
 * customer two days out is told "in 2 days" rather than being rounded up to
 * whatever bucket happened to catch them.
 */
function bandFor(expiresAt: Date, now: Date): { threshold: number; days: number } | null {
  const raw = (expiresAt.getTime() - now.getTime()) / DAY_MS;
  if (raw < 0) return null;

  // Two different roundings, on purpose.
  //
  // The band rounds UP, so anything with a fraction of a day left still falls
  // into the tighter bucket and gets warned rather than slipping through.
  //
  // The number shown to the customer rounds to NEAREST. Rounding it up was both
  // misleading — telling someone with 6.2 days that they have 7 overstates the
  // time they have to act — and unstable: at an exact day boundary, a
  // millisecond of clock skew between this process and the database flipped
  // 6.0 to 7.
  const threshold = THRESHOLDS.find((t) => Math.ceil(raw) <= t);
  return threshold === undefined ? null : { threshold, days: Math.max(0, Math.round(raw)) };
}

function money(currency: string, amount: number): string {
  return `${currency} ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

interface Expiring {
  id: string; tenant_id: string; tenant_name: string; owner_email: string | null;
  plan_name: string; status: string; billing_cycle: string; currency: string;
  expires_at: Date; is_trial: boolean; amount: number; has_card: boolean;
}

/**
 * The three situations read completely differently to a customer, so they get
 * three different emails rather than one hedged one.
 */
function compose(row: Expiring, days: number): { subject: string; html: string } {
  const when = new Date(row.expires_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const countdown = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  const plansUrl = `${env.FRONTEND_URL}/billing/plans`;
  const footer = `
    <p style="color:#4B5568;font-size:13px">
      Whatever happens, your compliance records stay available to read and
      export — we never lock you out of your own evidence.
    </p>
    <p style="color:#4B5568;font-size:13px">
      Questions? Contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
    </p>`;

  if (row.is_trial) {
    return {
      subject: `Your ComplianceCore trial ends ${countdown}`,
      html: `
        <h2>Your free trial ends ${countdown}</h2>
        <p>The trial for <strong>${row.tenant_name}</strong> ends on <strong>${when}</strong>.</p>
        <p>Choose a plan before then to keep full access. After it ends you keep
           a 7-day grace period, and then the account becomes read-only.</p>
        <p><a href="${plansUrl}"
              style="display:inline-block;background:#0F56C9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
           Choose a plan</a></p>
        ${footer}`,
    };
  }

  if (row.has_card) {
    // A courtesy notice, not a call to action. Charging without warning is how
    // a renewal becomes a chargeback.
    return {
      subject: `Your ComplianceCore subscription renews ${countdown}`,
      html: `
        <h2>Your subscription renews ${countdown}</h2>
        <p>We will charge your saved payment method
           <strong>${money(row.currency, row.amount)}</strong> on <strong>${when}</strong>
           to renew <strong>${row.plan_name}</strong> for <strong>${row.tenant_name}</strong>.</p>
        <p>No action is needed. To change plan, update your card, or cancel,
           visit your billing settings before that date.</p>
        <p><a href="${plansUrl}"
              style="display:inline-block;background:#0F56C9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
           Manage billing</a></p>
        ${footer}`,
    };
  }

  return {
    subject: `Action needed: your ComplianceCore subscription ends ${countdown}`,
    html: `
      <h2>We cannot renew your subscription</h2>
      <p><strong>${row.plan_name}</strong> for <strong>${row.tenant_name}</strong> ends on
         <strong>${when}</strong>, and there is no saved payment method to renew it with.</p>
      <p>Add a payment method or choose a plan before then to avoid interruption.
         After it ends you keep a 7-day grace period, and then the account
         becomes read-only.</p>
      <p><a href="${plansUrl}"
            style="display:inline-block;background:#0F56C9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
         Add a payment method</a></p>
      ${footer}`,
  };
}

export async function sendExpiryReminders(): Promise<void> {
  const now = new Date();
  const due = await billingRepo.findExpiringSubscriptions(MAX_THRESHOLD);

  logger.info({ count: due.length }, 'Checking subscriptions for expiry reminders');

  let sent = 0;
  for (const row of due as Expiring[]) {
    try {
      const band = bandFor(new Date(row.expires_at), now);
      if (!band) continue;
      if (!row.owner_email) {
        logger.warn({ tenantId: row.tenant_id }, 'Expiring subscription has no owner to notify');
        continue;
      }

      // Claim before sending. If the send then fails we have burned the slot
      // rather than risking a loop that mails the customer every retry — the
      // next threshold still catches them, and the in-app banner is showing.
      const claimed = await billingRepo.claimReminder(
        row.id, new Date(row.expires_at), band.threshold,
      );
      if (!claimed) continue;

      const { subject, html } = compose(row, band.days);
      await emailClient.sendRawEmail({ to: row.owner_email, subject, html });
      sent++;
      logger.info(
        {
          tenantId: row.tenant_id, tenant: row.tenant_name,
          days: band.days, threshold: band.threshold, trial: row.is_trial,
        },
        'Subscription expiry reminder sent',
      );
    } catch (err) {
      // One bad address must not stop the rest of the run.
      logger.error({ err, subscriptionId: row.id }, 'Failed to send expiry reminder');
    }
  }

  logger.info({ sent, considered: due.length }, 'Expiry reminders complete');
}

export function startSubscriptionReminderWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => { await sendExpiryReminders(); },
    { connection: redisForQueues, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Subscription reminder job failed');
  });

  return worker;
}
