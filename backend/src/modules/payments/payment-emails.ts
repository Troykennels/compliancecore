import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { sendRawEmail } from '../../lib/email';
import { prisma } from '../../lib/prisma';

// Confirmation emails for a completed payment.
//
// Both sides get one: the customer needs a record of what they were charged
// and until when, and the platform owner needs to know a sale happened without
// having to watch a dashboard. Paystack sends its own merchant notification,
// but that is Paystack's email about a transaction — not this product
// confirming what the customer actually received.

export interface PaymentReceiptContext {
  tenantId: string;
  userId: string | null;
  planId: string;
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  reference: string;
  periodStart: Date;
  periodEnd: Date;
}

function money(amount: number, currency: string): string {
  const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : '';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${symbol ? '' : ` ${currency}`}`;
}

function date(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Sends the customer receipt and the owner sale notification.
 *
 * Best-effort and never throws: the payment has already been taken and the
 * subscription activated by the time this runs, so a mail failure must not
 * surface as a failed payment or a retried webhook. Failures are logged with
 * the reference so a missing receipt can be traced.
 */
export async function sendPaymentEmails(ctx: PaymentReceiptContext): Promise<void> {
  try {
    const [tenant, user, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } }),
      ctx.userId
        ? prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true, firstName: true } })
        : Promise.resolve(null),
      prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM global.subscription_plans WHERE id = $1::uuid`,
        ctx.planId,
      ).then((r) => r[0] ?? null),
    ]);

    const planName = plan?.name ?? 'your plan';
    const orgName = tenant?.name ?? 'your organisation';
    const amount = money(ctx.amount, ctx.currency);
    const period = `${date(ctx.periodStart)} – ${date(ctx.periodEnd)}`;

    // ── Customer receipt ────────────────────────────────────────────────────
    if (user?.email) {
      await sendRawEmail({
        to: user.email,
        subject: `Payment received — ${planName} is now active`,
        html: `
          <p>Hi ${user.firstName || 'there'},</p>
          <p>Thank you — your payment has been received and <strong>${planName}</strong> is now active for
             <strong>${orgName}</strong>.</p>
          <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Plan</td><td style="padding:4px 0"><strong>${planName}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Amount paid</td><td style="padding:4px 0"><strong>${amount}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Billing</td><td style="padding:4px 0">${ctx.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Covers</td><td style="padding:4px 0">${period}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Reference</td><td style="padding:4px 0;font-family:monospace">${ctx.reference}</td></tr>
          </table>
          <p><a href="${env.FRONTEND_URL}/billing" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View billing</a></p>
          <p style="color:#64748b;font-size:13px">Your invoice is available to download from the Billing section at any time.
             Reply to this email if anything looks wrong.</p>
        `,
      });
    } else {
      logger.warn({ reference: ctx.reference }, 'Payment receipt skipped — no email on the paying user');
    }

    // ── Owner notification ──────────────────────────────────────────────────
    // Prefer the configured business address so revenue mail belongs to the
    // company rather than to whoever currently holds superadmin. Falls back to
    // every active superadmin, so a deployment that has not configured one
    // still gets told about its own sales.
    const owners = await resolveOwnerRecipients();

    for (const o of owners) {
      await sendRawEmail({
        to: o.email,
        subject: `💰 ${amount} — ${orgName} subscribed to ${planName}`,
        html: `
          <p><strong>${orgName}</strong> just paid <strong>${amount}</strong> for <strong>${planName}</strong>.</p>
          <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Organisation</td><td style="padding:4px 0"><strong>${orgName}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Paid by</td><td style="padding:4px 0">${user?.email ?? 'unknown'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Plan</td><td style="padding:4px 0">${planName} (${ctx.billingCycle})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Amount</td><td style="padding:4px 0"><strong>${amount}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Covers</td><td style="padding:4px 0">${period}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Reference</td><td style="padding:4px 0;font-family:monospace">${ctx.reference}</td></tr>
          </table>
          <p><a href="${env.FRONTEND_URL}/billing/admin">Open Billing Admin</a></p>
        `,
      });
    }

    logger.info(
      { reference: ctx.reference, customer: Boolean(user?.email), owners: owners.length },
      'Payment confirmation emails sent',
    );
  } catch (err) {
    logger.error({ err, reference: ctx.reference }, 'Could not send payment confirmation emails');
  }
}

/**
 * Recipients for owner-facing billing notifications.
 *
 * BILLING_NOTIFY_EMAIL wins when set, so these can point at a company mailbox
 * instead of a person. Falls back to active superadmins rather than sending
 * nowhere, because silently dropping revenue notifications is worse than
 * sending them to a personal address.
 */
export async function resolveOwnerRecipients(): Promise<Array<{ email: string }>> {
  const configured = env.BILLING_NOTIFY_EMAIL?.split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (configured?.length) return configured.map((email) => ({ email }));

  return prisma.user.findMany({
    where: { isSuperadmin: true, deletedAt: null, isActive: true },
    select: { email: true },
  });
}
