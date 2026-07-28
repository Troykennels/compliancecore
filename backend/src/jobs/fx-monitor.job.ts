import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { sendRawEmail } from '../lib/email';
import { reviewFxPricing } from '../modules/billing/fx-review.service';
import { resolveOwnerRecipients } from '../modules/payments/payment-emails';

// Daily check of how far foreign-currency prices have drifted from their USD
// equivalent, emailed to the platform owner when it matters.
//
// This job never changes a price. Live-FX pricing would mean a customer seeing
// a different figure between visits, renewals charging amounts nobody agreed
// to, and a bad rate response reaching real cards. Instead the owner is told
// when a price is stale and applies the change deliberately.

const QUEUE_NAME = 'fx-monitor';

export const fxMonitorQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { removeOnComplete: 20, removeOnFail: 50 },
});

async function processJob(_job: Job): Promise<void> {
  const review = await reviewFxPricing('NGN');

  if (!review.rate) {
    // Not an error worth alerting on — the next run will try again. Alerting on
    // a transient provider outage would train the owner to ignore these emails.
    logger.warn({ reason: review.unavailableReason }, 'FX monitor: rate unavailable, skipping');
    return;
  }

  const drifted = review.suggestions.filter((s) => s.needsReview);
  if (!drifted.length) {
    logger.info({ rate: review.rate }, 'FX monitor: all prices within threshold');
    return;
  }

  // Same recipients as billing notifications, so all owner-facing mail can be
  // pointed at a company address rather than a personal one.
  const owners = await resolveOwnerRecipients();
  if (!owners.length) {
    logger.warn('FX monitor: prices have drifted but there is nobody to notify');
    return;
  }

  const rows = drifted
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.planName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">$${s.usdMonthly}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">₦${s.currentMonthly.toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee"><strong>₦${s.suggestedMonthly.toLocaleString()}</strong></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.driftPercent > 0 ? '+' : ''}${s.driftPercent}%</td>
      </tr>`,
    )
    .join('');

  const html = `
    <p>The naira/dollar rate has moved enough that some of your prices are out of step.</p>
    <p>Current rate: <strong>1 USD = ₦${review.rate.toFixed(2)}</strong>
       &nbsp;·&nbsp; alert threshold: ${review.thresholdPercent}%</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr style="text-align:left;background:#f8fafc">
        <th style="padding:6px 10px">Plan</th><th style="padding:6px 10px">USD /mo</th>
        <th style="padding:6px 10px">Current NGN</th><th style="padding:6px 10px">Suggested NGN</th>
        <th style="padding:6px 10px">Drift</th>
      </tr>
      ${rows}
    </table>
    <p style="margin-top:16px">
      Nothing has changed automatically. Review and apply in
      <a href="${env.FRONTEND_URL}/billing/admin">Billing Admin</a>.
    </p>
    <p style="color:#64748b;font-size:12px">
      Existing subscribers keep the price they signed up at; only new checkouts use the new price.
    </p>`;

  for (const o of owners) {
    await sendRawEmail({
      to: o.email,
      subject: `ComplianceCore — ${drifted.length} plan price${drifted.length === 1 ? '' : 's'} drifted from USD`,
      html,
    });
  }

  logger.info({ drifted: drifted.length, rate: review.rate }, 'FX monitor: drift alert sent');
}

export function startFxMonitorWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processJob, { connection: redisForQueues, concurrency: 1 });
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'FX monitor job failed'));
  return worker;
}

export async function scheduleFxMonitorJob(): Promise<void> {
  // Once daily. The upstream feed only refreshes once a day, so anything more
  // frequent would just re-read the same number.
  await fxMonitorQueue.add(
    'daily-fx-check',
    {},
    { repeat: { pattern: '0 7 * * *' }, jobId: 'fx-monitor-daily' },
  );
}
