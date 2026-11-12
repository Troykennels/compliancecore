import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { SUPPORT_EMAIL } from '../../config/contact';
import { email as emailClient } from '../../lib/email';
import { logger } from '../../lib/logger';

// ─── Refunds, disputes and rejected webhooks (prompt sections 7 and 13) ─────
//
// Paystack refund (refund.*) and chargeback (charge.dispute.*) events are
// recorded once each (the provider can repeat them) and Orion Soft is alerted.
// Nothing about the customer's access changes automatically: a refund or a
// dispute is reviewed by a person, who corrects the subscription by hand in
// Billing Admin (audited) if that is what was agreed. Webhooks with a bad
// signature are recorded too, so a forged or misconfigured sender is visible.

export async function initPaymentIssues(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.payment_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(200) NOT NULL UNIQUE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('refund', 'dispute', 'webhook_rejected')),
    event VARCHAR(60),
    status VARCHAR(40),
    reference VARCHAR(120),
    tenant_id UUID,
    amount NUMERIC(12, 2),
    currency CHAR(3),
    detail JSONB NOT NULL DEFAULT '{}',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_payment_issues_created ON global.payment_issues (created_at DESC)`);
}

type PaystackEvent = { event?: string; data?: Record<string, any> };

export const isIssueEvent = (name?: string) => !!name && (name.startsWith('refund.') || name.startsWith('charge.dispute.'));

/** Records a refund or dispute event once; true when it was new. */
export async function recordPaymentIssue(evt: PaystackEvent): Promise<boolean> {
  const name = String(evt.event ?? '');
  const d = evt.data ?? {};
  const kind = name.startsWith('refund.') ? 'refund' : 'dispute';
  const reference = String(d.transaction_reference ?? d.transaction?.reference ?? d.reference ?? '') || null;
  const status = String(d.status ?? name.split('.').pop() ?? '') || null;
  const id = String(d.id ?? d.refund_reference ?? d.refund_id ?? '') || reference || 'unknown';
  // One row per provider object and state, so a repeated delivery is ignored
  // but a dispute moving from "created" to "resolved" is still recorded.
  const eventKey = `${name}:${id}:${status ?? ''}`.slice(0, 200);
  const minor = Number(d.amount ?? d.refund_amount ?? d.transaction?.amount);
  const amount = Number.isFinite(minor) ? minor / 100 : null;
  const currency = typeof d.currency === 'string' ? d.currency.toUpperCase().slice(0, 3) : null;

  let tenantId: string | null = null;
  if (reference) {
    const rows = await prisma.$queryRawUnsafe<Array<{ tenant_id: string }>>(
      `SELECT tenant_id FROM global.payment_transactions WHERE reference = $1 LIMIT 1`, reference);
    tenantId = rows[0]?.tenant_id ?? null;
  }
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO global.payment_issues (event_key, kind, event, status, reference, tenant_id, amount, currency, detail)
     VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9::jsonb) ON CONFLICT (event_key) DO NOTHING`,
    eventKey, kind, name, status, reference, tenantId, amount, currency,
    JSON.stringify({ id, resolution: d.resolution ?? null, reason: d.reason ?? d.merchant_note ?? null }));
  if (!inserted) return false;

  logger.warn({ event: name, reference, tenantId, amount, currency }, 'Paystack refund or dispute recorded for review');
  const to = env.BILLING_NOTIFY_EMAIL || SUPPORT_EMAIL;
  try {
    await emailClient.sendRawEmail({
      to,
      subject: `ComplianceCore: ${kind === 'refund' ? 'refund' : 'chargeback / dispute'} ${status ?? ''} for ${reference ?? 'a payment'}`,
      html: `<p>Paystack sent <strong>${name}</strong>${status ? ` (status <strong>${status}</strong>)` : ''}
        for payment <strong>${reference ?? 'unknown'}</strong>${amount !== null ? `, amount ${currency ?? ''} ${amount.toFixed(2)}` : ''}.</p>
        <p>The customer's access has <strong>not</strong> been changed. Review it in Billing Admin, Payment issues,
        and correct the subscription by hand if needed.</p>`,
    });
  } catch (err) {
    logger.error({ err }, 'Could not email the payment issue alert');
  }
  return true;
}

/** A webhook with a bad signature (forged or misconfigured sender). */
export async function recordRejectedWebhook(rawBody: Buffer): Promise<void> {
  try {
    const hint = rawBody.subarray(0, 2000).toString('utf8');
    let name: string | null = null;
    let reference: string | null = null;
    try { const j = JSON.parse(hint); name = j?.event ?? null; reference = j?.data?.reference ?? null; } catch { /* not JSON */ }
    // One row per minute at most, so a flood cannot fill the table.
    const minute = new Date().toISOString().slice(0, 16);
    await prisma.$executeRawUnsafe(
      `INSERT INTO global.payment_issues (event_key, kind, event, reference, detail)
       VALUES ($1, 'webhook_rejected', $2, $3, '{}'::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      `rejected:${minute}`, name ? String(name).slice(0, 60) : null, reference ? String(reference).slice(0, 120) : null);
  } catch (err) {
    logger.error({ err }, 'Could not record a rejected webhook');
  }
}

export async function listPaymentIssues(limit = 200) {
  return prisma.$queryRawUnsafe<unknown[]>(
    `SELECT i.id, i.kind, i.event, i.status, i.reference, i.amount, i.currency, i.detail, i.resolved_at, i.created_at,
            t.name AS tenant_name
       FROM global.payment_issues i LEFT JOIN global.tenants t ON t.id = i.tenant_id
      ORDER BY i.created_at DESC LIMIT $1`, Math.min(Math.max(limit, 1), 500));
}

export async function resolvePaymentIssue(id: string): Promise<boolean> {
  return (await prisma.$executeRawUnsafe(
    `UPDATE global.payment_issues SET resolved_at = NOW() WHERE id = $1::uuid AND resolved_at IS NULL`, id)) > 0;
}
