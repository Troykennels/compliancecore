import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import * as billingRepo from '../billing/billing.repository';
import * as billingService from '../billing/billing.service';
import * as repo from './payments.repository';
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  isPaystackConfigured,
} from './paystack.client';

export type BillingCycle = 'monthly' | 'yearly';

function allowedCurrencies(): string[] {
  return env.PAYMENT_CURRENCIES.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
}

export function getPublicConfig() {
  return {
    configured: isPaystackConfigured(),
    provider: 'paystack',
    publicKey: env.PAYSTACK_PUBLIC_KEY ?? null,
    currencies: allowedCurrencies(),
  };
}

/**
 * Starts a checkout and returns the hosted payment URL.
 *
 * Nothing about the subscription changes here — the plan is only applied once
 * the payment is confirmed server-side (see applyPaidTransaction). Treating
 * "checkout started" as "paid" is the classic way to give away paid plans.
 */
export async function createCheckout(input: {
  tenantId: string;
  userId: string;
  email: string;
  planId: string;
  currency: string;
  billingCycle: BillingCycle;
}): Promise<{ authorizationUrl: string; reference: string; amount: number; currency: string }> {
  if (!isPaystackConfigured()) {
    throw new AppError('Payments are not configured on this deployment.', 503, 'PAYMENTS_UNCONFIGURED');
  }

  const currency = input.currency.toUpperCase();
  if (!allowedCurrencies().includes(currency)) {
    throw new ValidationError(`Unsupported currency "${currency}".`);
  }

  const plan = await billingRepo.findPlanById(input.planId);
  if (!plan) throw new NotFoundError('Plan', input.planId);

  const price = await repo.findPlanPrice(input.planId, currency);
  if (!price) {
    throw new ValidationError(`Plan "${plan.name}" has no price set for ${currency}.`);
  }

  const basePrice = input.billingCycle === 'yearly' ? price.priceYearly : price.priceMonthly;

  // Honour any discount already on the subscription. Without this a coupon
  // holder is charged the full list price at checkout while their subscription
  // reports the discounted amount as due — i.e. billed more than they owe.
  const sub = await billingRepo.findSubscriptionByTenant(input.tenantId);
  const amount = sub
    ? billingService.applyDiscount(basePrice, sub.discountPercent, sub.discountFixed)
    : basePrice;

  if (amount <= 0) {
    // Nothing to collect — either a free plan or a discount that covers the
    // full amount. Paystack rejects a zero amount, so this must not round-trip
    // through the provider.
    throw new ValidationError('No payment is required for this plan. Change the plan directly.');
  }

  // Our own reference doubles as the idempotency key. Random suffix so a retried
  // checkout for the same plan never collides with an in-flight attempt.
  const reference = `cc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  await repo.createTransaction({
    reference,
    tenantId: input.tenantId,
    userId: input.userId,
    planId: input.planId,
    billingCycle: input.billingCycle,
    currency,
    amount,
  });

  const result = await initializeTransaction({
    email: input.email,
    amountMajor: amount,
    currency,
    reference,
    // Return to the page the user started from, so the result is shown in
    // context next to the plan they chose. Must match the route that reads
    // ?reference= and calls /payments/confirm (billing-plans.page.tsx).
    callbackUrl: `${env.FRONTEND_URL}/billing/plans?reference=${reference}`,
    // Echoed back on the webhook; useful when reconciling in the Paystack
    // dashboard, but never trusted as the source of truth — the reference is.
    metadata: {
      tenantId: input.tenantId,
      planId: input.planId,
      planName: plan.name,
      billingCycle: input.billingCycle,
    },
  });

  return { authorizationUrl: result.authorization_url, reference, amount, currency };
}

/**
 * Applies a confirmed payment: claims the transaction, then activates or
 * upgrades the subscription.
 *
 * Safe to call repeatedly and concurrently — claimTransaction only returns a row
 * to the first caller that flips it out of 'pending', so replayed webhooks and a
 * racing redirect-verify collapse into one activation.
 */
async function applyPaidTransaction(
  reference: string,
  providerRef: string | null,
  paidAt: Date | null,
): Promise<{ applied: boolean }> {
  const claimed = await repo.claimTransaction(reference, providerRef, paidAt);
  if (!claimed) {
    logger.info({ reference }, 'Payment already processed or not pending — ignoring');
    return { applied: false };
  }

  const existing = await billingRepo.findSubscriptionByTenant(claimed.tenantId);

  if (existing) {
    // paidUpgrade: the charge for this exact plan and cycle has already been
    // verified with the provider above, so this is the one place allowed to
    // move a tenant onto a more expensive plan.
    await billingService.updateSubscription(
      claimed.tenantId,
      { planId: claimed.planId, billingCycle: claimed.billingCycle, status: 'active' } as never,
      { paidUpgrade: true },
    );

    // Grant the period that was actually paid for.
    //
    // updateSubscription deliberately does not move current_period_start/end —
    // an admin correcting a plan mid-period should not hand out free service.
    // But a *payment* buys a fresh term, and without this the customer keeps
    // whatever period they already had: someone upgrading monthly -> yearly paid
    // the yearly price and still expired a month later, and the renewal job
    // (which keys off current_period_end) re-invoiced them then.
    const start = billingService.periodStart(claimed.billingCycle);
    const end = billingService.periodEnd(start, claimed.billingCycle);
    await billingRepo.updateSubscription(existing.id, {
      current_period_start: start,
      current_period_end: end,
    });
  } else {
    // Payment already taken, so no trial: starting one here would delay the
    // first real invoice and misreport revenue.
    await billingService.createSubscription(
      claimed.tenantId,
      { planId: claimed.planId, billingCycle: claimed.billingCycle },
      { paidUpgrade: true },
    );
  }

  logger.info(
    { reference, tenantId: claimed.tenantId, planId: claimed.planId, amount: claimed.amount, currency: claimed.currency },
    'Payment applied — subscription activated',
  );
  return { applied: true };
}

/**
 * Confirms a payment from the browser redirect. The redirect carries only a
 * reference, which a user could forge, so the amount and status are re-read from
 * Paystack before anything is granted.
 */
export async function confirmByReference(tenantId: string, reference: string) {
  const tx = await repo.findTransactionByReference(reference);
  if (!tx) throw new NotFoundError('Payment', reference);
  // Scope to the caller's tenant so one organisation cannot confirm — or probe
  // for — another organisation's payment references.
  if (tx.tenantId !== tenantId) throw new NotFoundError('Payment', reference);

  if (tx.status === 'success') return { status: 'success' as const, alreadyApplied: true };

  const verified = await verifyTransaction(reference);

  if (verified.status !== 'success') {
    await repo.markTransactionFailed(reference, verified.status === 'abandoned' ? 'abandoned' : 'failed', verified.status);
    return { status: verified.status, alreadyApplied: false };
  }

  assertAmountMatches(tx, verified.amount, verified.currency, reference);
  const { applied } = await applyPaidTransaction(reference, verified.reference, verified.paid_at ? new Date(verified.paid_at) : null);
  return { status: 'success' as const, alreadyApplied: !applied };
}

/**
 * Rejects a payment whose amount or currency does not match what we recorded at
 * checkout. Paystack's initialize call fixes the amount, but verifying it again
 * closes the gap where a tampered or mismatched transaction could activate an
 * expensive plan for a cheap payment.
 */
function assertAmountMatches(
  tx: { amount: number; currency: string },
  paidMinor: number,
  paidCurrency: string,
  reference: string,
): void {
  const expectedMinor = Math.round(tx.amount * 100);
  if (paidMinor < expectedMinor || paidCurrency.toUpperCase() !== tx.currency.toUpperCase()) {
    logger.error(
      { reference, expectedMinor, paidMinor, expected: tx.currency, paid: paidCurrency },
      'Payment amount/currency mismatch — refusing to activate',
    );
    throw new AppError('Payment amount did not match the expected charge.', 400, 'PAYMENT_MISMATCH');
  }
}

/**
 * Handles a Paystack webhook.
 *
 * `rawBody` must be the exact bytes Paystack sent — the signature is an HMAC
 * over those bytes, so a re-serialised JSON object will never validate.
 */
export async function handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new AppError('Invalid webhook signature.', 401, 'INVALID_SIGNATURE');
  }

  let event: { event?: string; data?: { reference?: string; status?: string; amount?: number; currency?: string; paid_at?: string } };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ValidationError('Malformed webhook payload.');
  }

  const reference = event.data?.reference;
  if (!reference) return;

  if (event.event !== 'charge.success') {
    logger.info({ event: event.event, reference }, 'Ignoring non-success Paystack event');
    return;
  }

  const tx = await repo.findTransactionByReference(reference);
  if (!tx) {
    // Not ours (or from another environment sharing the account). Returning
    // normally still ACKs so Paystack stops retrying.
    logger.warn({ reference }, 'Webhook for unknown payment reference');
    return;
  }

  // Re-verify server-side rather than trusting the webhook body, then check the
  // amount before granting anything.
  const verified = await verifyTransaction(reference);
  if (verified.status !== 'success') {
    await repo.markTransactionFailed(reference, 'failed', verified.status);
    return;
  }

  assertAmountMatches(tx, verified.amount, verified.currency, reference);
  await applyPaidTransaction(reference, verified.reference, verified.paid_at ? new Date(verified.paid_at) : null);
}

export async function listTenantPayments(tenantId: string) {
  return repo.listTransactionsByTenant(tenantId);
}

export async function getPlanPrices(planId: string) {
  return repo.listPlanPrices(planId);
}
