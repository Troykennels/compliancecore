import { prisma } from '../../lib/prisma';

// NOTE ON CASTS: Prisma's $queryRawUnsafe binds JS strings as `text`, and
// Postgres has no implicit text->uuid / text->timestamptz assignment cast. Every
// uuid or timestamp placeholder below is therefore cast explicitly. Omitting one
// throws 42883 at runtime, which is exactly how the billing plan-change bug
// reached production.

export interface PlanPrice {
  planId: string;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
}

export async function findPlanPrice(planId: string, currency: string): Promise<PlanPrice | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT plan_id, currency, price_monthly, price_yearly
       FROM global.plan_prices
      WHERE plan_id = $1::uuid AND currency = UPPER($2) AND is_active
      LIMIT 1`,
    planId,
    currency,
  )) as any[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    planId: r.plan_id,
    currency: String(r.currency).trim(),
    priceMonthly: Number(r.price_monthly),
    priceYearly: Number(r.price_yearly),
  };
}

export async function listPlanPrices(planId: string): Promise<PlanPrice[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT plan_id, currency, price_monthly, price_yearly
       FROM global.plan_prices WHERE plan_id = $1::uuid AND is_active ORDER BY currency`,
    planId,
  )) as any[];
  return rows.map((r) => ({
    planId: r.plan_id,
    currency: String(r.currency).trim(),
    priceMonthly: Number(r.price_monthly),
    priceYearly: Number(r.price_yearly),
  }));
}

export interface PaymentTransaction {
  id: string;
  reference: string;
  tenantId: string;
  /** Who paid — used to address the receipt. Null if the user was since removed. */
  userId: string | null;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  currency: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  processedAt: Date | null;
}

function mapTx(r: any): PaymentTransaction {
  return {
    id: r.id,
    reference: r.reference,
    tenantId: r.tenant_id,
    userId: r.user_id ?? null,
    planId: r.plan_id,
    billingCycle: r.billing_cycle,
    currency: String(r.currency).trim(),
    amount: Number(r.amount),
    status: r.status,
    processedAt: r.processed_at ? new Date(r.processed_at) : null,
  };
}

export async function createTransaction(input: {
  reference: string;
  tenantId: string;
  userId: string | null;
  planId: string;
  billingCycle: string;
  currency: string;
  amount: number;
}): Promise<PaymentTransaction> {
  const rows = (await prisma.$queryRawUnsafe(
    `INSERT INTO global.payment_transactions
       (reference, tenant_id, user_id, plan_id, billing_cycle, currency, amount)
     VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, UPPER($6), $7)
     RETURNING *`,
    input.reference,
    input.tenantId,
    input.userId,
    input.planId,
    input.billingCycle,
    input.currency,
    input.amount,
  )) as any[];
  return mapTx(rows[0]);
}

export async function findTransactionByReference(reference: string): Promise<PaymentTransaction | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT * FROM global.payment_transactions WHERE reference = $1 LIMIT 1`,
    reference,
  )) as any[];
  return rows.length ? mapTx(rows[0]) : null;
}

/**
 * Atomically claims a pending transaction for processing.
 *
 * The `status = 'pending'` guard in the WHERE clause is the idempotency lock:
 * Paystack retries webhooks and can deliver the same event concurrently with the
 * browser-redirect verify call, so two requests may try to apply one payment at
 * once. Postgres serialises the UPDATE, so exactly one caller sees a row
 * returned and the other gets null and stops. Without this, a retried webhook
 * would activate the plan and write an invoice twice.
 */
export async function claimTransaction(
  reference: string,
  providerRef: string | null,
  paidAt: Date | null,
): Promise<PaymentTransaction | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `UPDATE global.payment_transactions
        SET status = 'success', processed_at = NOW(), updated_at = NOW(),
            provider_ref = $2, paid_at = $3::timestamptz
      WHERE reference = $1 AND status = 'pending'
      RETURNING *`,
    reference,
    providerRef,
    paidAt,
  )) as any[];
  return rows.length ? mapTx(rows[0]) : null;
}

export async function markTransactionFailed(
  reference: string,
  status: 'failed' | 'abandoned',
  reason: string | null,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.payment_transactions
        SET status = $2, failure_reason = $3, updated_at = NOW()
      WHERE reference = $1 AND status = 'pending'`,
    reference,
    status,
    reason,
  );
}

export async function listTransactionsByTenant(tenantId: string, limit = 50): Promise<PaymentTransaction[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT * FROM global.payment_transactions
      WHERE tenant_id = $1::uuid ORDER BY created_at DESC LIMIT ${Number(limit)}`,
    tenantId,
  )) as any[];
  return rows.map(mapTx);
}
