import crypto from 'node:crypto';
import { auditCurrentActor } from '../../lib/audit-context';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { email as emailClient } from '../../lib/email';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { advancePeriod } from '../billing/billing.service';
import { initializeTransaction, isPaystackConfigured } from './paystack.client';

// Paying an open invoice, in full or in parts. Every payment is added to that
// same invoice (never a fresh one) until its balance reaches zero; a renewal
// invoice then grants its billing period exactly as an automatic renewal would.

export const INVOICE_REFERENCE_PREFIX = 'CCI-';
// Smallest part-payment (a smaller final balance is always accepted).
export const MIN_PART_PAYMENT = 100;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function initInvoicePayments(): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE global.payment_transactions
    ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES global.invoices(id) ON DELETE SET NULL`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_payment_tx_invoice ON global.payment_transactions (invoice_id) WHERE invoice_id IS NOT NULL`);
}

function allowedCurrencies(): string[] {
  return env.PAYMENT_CURRENCIES.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
}

/** The open invoice a tenant still owes on, if any part of it has been paid. */
export async function partPaidInvoice(tenantId: string): Promise<{ id: string; number: string; balance: number; currency: string } | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT id,number,amount_due,amount_paid,currency FROM global.invoices
    WHERE tenant_id=$1::uuid AND status='open' AND amount_paid>0 AND amount_paid<amount_due ORDER BY created_at LIMIT 1`, tenantId);
  const r = rows[0];
  return r ? { id: r.id, number: r.number, balance: round2(Number(r.amount_due) - Number(r.amount_paid)), currency: String(r.currency).trim() } : null;
}

export async function createInvoiceCheckout(input: {
  tenantId: string; userId: string; email: string; invoiceId: string; amount?: number;
}): Promise<{ authorizationUrl: string; reference: string; amount: number; currency: string }> {
  if (!isPaystackConfigured()) throw new AppError('Payments are not configured on this deployment.', 503, 'PAYMENTS_UNCONFIGURED');
  const demo = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM global.tenant_onboarding WHERE tenant_id=$1::uuid`, input.tenantId);
  if (demo[0]?.status === 'demo') throw new AppError('This is a demonstration workspace. Use your own organisation for a real payment.', 403, 'DEMO_WORKSPACE');
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT i.*, s.plan_id, s.billing_cycle FROM global.invoices i
    LEFT JOIN global.subscriptions s ON s.id=i.subscription_id OR (i.subscription_id IS NULL AND s.tenant_id=i.tenant_id)
    WHERE i.id=$1::uuid AND i.tenant_id=$2::uuid LIMIT 1`, input.invoiceId, input.tenantId);
  const inv = rows[0];
  if (!inv) throw new NotFoundError('Invoice', input.invoiceId);
  const currency = String(inv.currency).trim().toUpperCase();
  const balance = round2(Number(inv.amount_due) - Number(inv.amount_paid));
  if (inv.status !== 'open' || balance <= 0) throw new ValidationError('This invoice has nothing left to pay.');
  if (!allowedCurrencies().includes(currency)) throw new ValidationError(`Online payment isn't available in ${currency}.`);
  if (!inv.plan_id) throw new AppError('This invoice needs Orion Soft to arrange payment. Contact support.', 409, 'INVOICE_NOT_PAYABLE');
  const amount = input.amount === undefined ? balance : round2(input.amount);
  if (!(amount > 0)) throw new ValidationError('Enter an amount above zero.');
  if (amount > balance + 0.004) throw new ValidationError(`The most you can pay is the balance of ${currency} ${balance.toFixed(2)}.`);
  if (amount < Math.min(MIN_PART_PAYMENT, balance) - 0.004) throw new ValidationError(`The smallest part-payment is ${currency} ${MIN_PART_PAYMENT.toFixed(2)}.`);

  // A double-click or reload reuses the open checkout for the same amount.
  const pending = await prisma.$queryRawUnsafe<any[]>(`SELECT reference,authorization_url FROM global.payment_transactions
    WHERE invoice_id=$1::uuid AND status='pending' AND amount=$2 AND authorization_url IS NOT NULL AND created_at > now() - interval '20 minutes'
    ORDER BY created_at DESC LIMIT 1`, inv.id, amount);
  if (pending[0]) return { authorizationUrl: pending[0].authorization_url, reference: pending[0].reference, amount, currency };

  const reference = `${INVOICE_REFERENCE_PREFIX}${crypto.randomUUID().replace(/-/g, '')}`;
  await prisma.$executeRawUnsafe(`INSERT INTO global.payment_transactions(reference,tenant_id,user_id,plan_id,billing_cycle,currency,amount,subscription_amount,invoice_id)
    VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$7,$8::uuid)`, reference, input.tenantId, input.userId, inv.plan_id, inv.billing_cycle || 'monthly', currency, amount, inv.id);
  const result = await initializeTransaction({
    email: input.email, amountMajor: amount, currency, reference,
    callbackUrl: `${env.FRONTEND_URL}/billing/invoices?reference=${reference}`,
    metadata: { tenantId: input.tenantId, invoiceId: inv.id, invoiceNumber: inv.number, kind: 'invoice' },
  }).catch(async (err) => {
    await prisma.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='failed',failure_reason='Checkout initialization did not return a payment link' WHERE reference=$1 AND status='pending'`, reference);
    throw err;
  });
  await prisma.$executeRawUnsafe(`UPDATE global.payment_transactions SET authorization_url=$2 WHERE reference=$1`, reference, result.authorization_url);
  return { authorizationUrl: result.authorization_url, reference, amount, currency };
}

/**
 * Adds a verified payment to its invoice exactly once. Tenant, transaction and
 * invoice are locked together, so a webhook and the browser return racing each
 * other (or two part-payments landing at once) each see the other's effect.
 */
export async function settleInvoicePayment(reference: string, providerRef: string | null, paidAt: Date, payerEmail: string | null) {
  if (!Number.isFinite(+paidAt) || +paidAt > Date.now() + 300000) throw new AppError('Invalid payment timestamp.', 400, 'PAYMENT_MISMATCH');
  const initial = await prisma.$queryRawUnsafe<any[]>(`SELECT tenant_id FROM global.payment_transactions WHERE reference=$1`, reference);
  if (!initial[0]) return null;
  const outcome = await prisma.$transaction(async (tx) => {
    await auditCurrentActor(tx);
    await tx.$queryRawUnsafe(`SELECT id FROM global.tenants WHERE id=$1::uuid FOR UPDATE`, initial[0].tenant_id);
    const payment = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.payment_transactions WHERE reference=$1 FOR UPDATE`, reference))[0];
    if (!payment || payment.status !== 'pending' || !payment.invoice_id) return null;
    const inv = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.invoices WHERE id=$1::uuid FOR UPDATE`, payment.invoice_id))[0];
    const amount = Number(payment.amount);
    const balance = inv ? round2(Number(inv.amount_due) - Number(inv.amount_paid)) : 0;
    if (!inv || inv.status !== 'open' || amount > balance + 0.004) {
      // Settled or voided another way meanwhile. Record the money for review
      // (refund or credit); never push the invoice past what was due.
      await tx.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='success',processed_at=now(),paid_at=$2::timestamptz,provider_ref=$3,
        failure_reason='Received after the invoice was settled. Review for refund or credit.',updated_at=now() WHERE reference=$1`, reference, paidAt, providerRef);
      logger.error({ reference, invoiceId: payment.invoice_id }, 'Invoice payment arrived after settlement — held for review');
      return { review: true, tenantId: payment.tenant_id, invoiceId: payment.invoice_id, amount, currency: String(payment.currency).trim() };
    }
    const paid = round2(Number(inv.amount_paid) + amount);
    const settled = paid >= Number(inv.amount_due) - 0.004;
    const history = [...(Array.isArray(inv.metadata?.payments) ? inv.metadata.payments : []), { reference, amount, paidAt: paidAt.toISOString() }];
    let periodStart = new Date(inv.billing_period_start), periodEnd = new Date(inv.billing_period_end);
    if (settled && inv.subscription_id) {
      // A renewal invoice paid off grants its period, like a collected renewal.
      const sub = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.subscriptions WHERE id=$1::uuid FOR UPDATE`, inv.subscription_id))[0];
      if (sub && sub.status !== 'cancelled' && +new Date(sub.current_period_end) <= +periodStart + 60000) {
        periodStart = new Date(Math.max(+new Date(sub.current_period_end), +paidAt));
        periodEnd = advancePeriod(periodStart, sub.billing_cycle);
        await tx.$executeRawUnsafe(`UPDATE global.subscriptions SET status='active',current_period_start=$2::timestamptz,current_period_end=$3::timestamptz,updated_at=now() WHERE id=$1::uuid`, sub.id, periodStart, periodEnd);
      }
    }
    await tx.$executeRawUnsafe(`UPDATE global.invoices SET amount_paid=$2,status=$3,paid_at=$4::timestamptz,billing_period_start=$5::timestamptz,billing_period_end=$6::timestamptz,
      metadata=metadata || $7::jsonb,updated_at=now() WHERE id=$1::uuid`, inv.id, paid, settled ? 'paid' : 'open', settled ? paidAt : null, periodStart, periodEnd, JSON.stringify({ payments: history }));
    await tx.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='success',processed_at=now(),paid_at=$2::timestamptz,provider_ref=$3,updated_at=now() WHERE reference=$1`, reference, paidAt, providerRef);
    return { review: false, tenantId: payment.tenant_id, invoiceId: inv.id, number: inv.number, amount, paid, due: Number(inv.amount_due), settled, currency: String(payment.currency).trim() };
  });
  if (outcome && !outcome.review && payerEmail) void sendInvoiceReceipt(payerEmail, outcome as Required<typeof outcome>);
  return outcome;
}

async function sendInvoiceReceipt(to: string, o: { number: string; amount: number; paid: number; due: number; settled: boolean; currency: string }) {
  const money = (n: number) => `${o.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  try {
    await emailClient.sendRawEmail({
      to,
      subject: `Payment received — ${o.number} — ComplianceCore`,
      html: `<h2>Payment received</h2>
        <p>Thank you. We've received <strong>${money(o.amount)}</strong> towards invoice <strong>${o.number}</strong>.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td><strong>Invoice total</strong></td><td>${money(o.due)}</td></tr>
          <tr><td><strong>Paid so far</strong></td><td>${money(o.paid)}</td></tr>
          <tr><td><strong>Balance</strong></td><td>${money(Math.max(0, o.due - o.paid))}</td></tr>
        </table>
        <p>${o.settled ? 'The invoice is now fully paid.' : 'You can pay the rest, all at once or in parts, from Billing → Invoices. Every payment is added to this same invoice.'}</p>
        <p>The updated invoice is available to download in your billing settings.</p>`,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to send invoice payment receipt');
  }
}

/**
 * Fallback for a missed webhook (the Paystack account is shared across Orion
 * products): verify recent unconfirmed invoice checkouts and settle the paid
 * ones on their invoice. Optionally scoped to one organisation.
 */
export async function reconcilePendingInvoicePayments(tenantId?: string, limit = 10): Promise<number> {
  if (!isPaystackConfigured()) return 0;
  const rows = await prisma.$queryRawUnsafe<{ reference: string }[]>(`SELECT reference FROM global.payment_transactions
    WHERE status='pending' AND invoice_id IS NOT NULL AND reference LIKE 'CCI-%' AND created_at > now() - interval '7 days'
      ${tenantId ? `AND tenant_id=$2::uuid` : ''}
    ORDER BY updated_at ASC LIMIT $1`, ...(tenantId ? [limit, tenantId] : [limit]));
  const { confirmPendingInvoicePayment } = await import('./payments.service');
  let settled = 0;
  for (const { reference } of rows) {
    try {
      if ((await confirmPendingInvoicePayment(reference))?.status === 'success') settled++;
      else await prisma.$executeRawUnsafe(`UPDATE global.payment_transactions SET updated_at=now() WHERE reference=$1 AND status='pending'`, reference);
    } catch (err) {
      logger.warn({ err, reference }, 'Invoice payment verification deferred');
    }
  }
  return settled;
}
