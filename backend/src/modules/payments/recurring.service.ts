import crypto from 'node:crypto';
import { prisma } from '../../config/database';
import { encrypt, decrypt } from '../../lib/crypto';
import { advancePeriod } from '../billing/billing.service';
import { verifyTransaction, chargeAuthorization } from './paystack.client';

// Durable consent and attempts are separate from display-only payment methods.
// Old saved cards are deliberately not enrolled by this migration.
export async function initRecurringTables() {
  await prisma.$executeRawUnsafe(`ALTER TABLE global.payment_transactions
    ADD COLUMN IF NOT EXISTS recurring_consent boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS consent_at timestamptz`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.recurring_consents (
    tenant_id uuid PRIMARY KEY REFERENCES global.tenants(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false, authorization_enc text, email text,
    amount numeric(12,2), currency text, plan_id uuid, cycle text,
    last4 text, consent_at timestamptz, cancelled_at timestamptz)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.renewal_attempts (
    reference text PRIMARY KEY, subscription_id uuid NOT NULL REFERENCES global.subscriptions(id) ON DELETE CASCADE,
    period_end timestamptz NOT NULL, attempt integer NOT NULL, invoice_id uuid NOT NULL,
    tenant_id uuid NOT NULL, amount numeric(12,2) NOT NULL, currency text NOT NULL,
    email text NOT NULL, status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz,
    UNIQUE(subscription_id, period_end, attempt))`);
}

export async function rememberConsent(reference: string, auth: { authorization_code: string; reusable: boolean; channel: string | null; last4: string | null }, email: string) {
  if (!auth.reusable || !['card','direct_debit'].includes(auth.channel || '')) return;
  const initial = await prisma.$queryRawUnsafe<any[]>(`SELECT tenant_id FROM global.payment_transactions WHERE reference=$1`,reference);
  if (!initial[0]) return;
  await prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT id FROM global.tenants WHERE id=$1::uuid FOR UPDATE`, initial[0].tenant_id);
    const rows = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.payment_transactions WHERE reference=$1 FOR UPDATE`, reference);
    const payment = rows[0];
    if (!payment?.recurring_consent || !payment.consent_at) return;
    await tx.$executeRawUnsafe(`INSERT INTO global.recurring_consents
      (tenant_id,enabled,authorization_enc,email,amount,currency,plan_id,cycle,last4,consent_at)
      VALUES($1::uuid,true,$2,$3,$4,$5,$6::uuid,$7,$8,$9::timestamptz)
      ON CONFLICT(tenant_id) DO UPDATE SET enabled=true,authorization_enc=EXCLUDED.authorization_enc,
        email=EXCLUDED.email,amount=EXCLUDED.amount,currency=EXCLUDED.currency,plan_id=EXCLUDED.plan_id,
        cycle=EXCLUDED.cycle,last4=EXCLUDED.last4,consent_at=EXCLUDED.consent_at,cancelled_at=NULL
      WHERE global.recurring_consents.cancelled_at IS NULL OR global.recurring_consents.cancelled_at < EXCLUDED.consent_at`,
    payment.tenant_id, encrypt(auth.authorization_code), email, payment.subscription_amount ?? payment.amount, String(payment.currency).trim(), payment.plan_id, payment.billing_cycle, auth.last4, payment.consent_at);
  });
}

export async function cancelRecurring(tenantId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT id FROM global.tenants WHERE id=$1::uuid FOR UPDATE`, tenantId);
    await tx.$executeRawUnsafe(`INSERT INTO global.recurring_consents(tenant_id,enabled,cancelled_at)
      VALUES($1::uuid,false,now()) ON CONFLICT(tenant_id) DO UPDATE SET enabled=false,cancelled_at=now()`, tenantId);
    await tx.$executeRawUnsafe(`UPDATE global.payment_transactions SET recurring_consent=false
      WHERE tenant_id=$1::uuid AND status='pending' AND recurring_consent`, tenantId);
  });
  return { enabled: false };
}

export async function recurringStatus(tenantId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT enabled,last4,amount,currency,cycle FROM global.recurring_consents WHERE tenant_id=$1::uuid`, tenantId);
  const r = rows[0];
  return r ? { enabled:r.enabled, last4:r.last4, amount:Number(r.amount), currency:r.currency, cycle:r.cycle } : { enabled:false };
}

export async function reconcileRenewal(reference: string): Promise<{ status: 'paid' | 'unpaid'; paidAt?: Date; reason?: string }> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM global.renewal_attempts WHERE reference=$1`, reference);
  const row = rows[0];
  if (!row) return { status:'unpaid', reason:'Unknown renewal reference.' };
  if (row.status === 'paid') return { status:'paid' };
  let verified;
  try { verified = await verifyTransaction(reference); } catch { return { status:'unpaid', reason:'Payment confirmation is pending. Do not pay twice.' }; }
  const matches = verified.reference === reference && verified.amount === Math.round(Number(row.amount)*100)
    && verified.currency === row.currency && verified.customer?.email?.toLowerCase() === row.email.toLowerCase();
  if (!matches) return { status:'unpaid', reason:'Payment verification does not match the agreed charge.' };
  if (verified.status !== 'success') {
    await prisma.$executeRawUnsafe(`UPDATE global.renewal_attempts SET checked_at=now(),status=$2 WHERE reference=$1 AND status<>'paid'`, reference, ['failed','abandoned'].includes(verified.status)?'failed':'pending');
    if (['failed','abandoned'].includes(verified.status)) await prisma.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='failed',failure_reason=$2 WHERE reference=$1 AND status='pending'`, reference, verified.status);
    return { status:'unpaid', reason:verified.status === 'failed' ? 'The payment was declined.' : 'Payment confirmation is pending. Do not pay twice.' };
  }
  const paidAt = new Date(verified.paid_at || '');
  if (!Number.isFinite(+paidAt) || +paidAt > Date.now()+300000) return { status:'unpaid', reason:'Payment timestamp could not be verified.' };
  let applied=false;
  await prisma.$transaction(async tx => {
    const subs = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.subscriptions WHERE id=$1::uuid FOR UPDATE`, row.subscription_id);
    const attempts = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.renewal_attempts WHERE reference=$1 FOR UPDATE`, reference);
    if (attempts[0].status === 'paid') return;
    const sub = subs[0];
    const start = new Date(Math.max(+new Date(sub.current_period_end), +paidAt));
    const end = advancePeriod(start, sub.billing_cycle);
    await tx.$executeRawUnsafe(`UPDATE global.subscriptions SET status='active',current_period_start=$2::timestamptz,current_period_end=$3::timestamptz,updated_at=now() WHERE id=$1::uuid`, row.subscription_id,start,end);
    await tx.$executeRawUnsafe(`UPDATE global.invoices SET status='paid',amount_paid=$2,paid_at=$3::timestamptz,billing_period_start=$4::timestamptz,billing_period_end=$5::timestamptz,updated_at=now() WHERE id=$1::uuid`, row.invoice_id,row.amount,paidAt,start,end);
    await tx.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='success',processed_at=now(),paid_at=$2::timestamptz,provider_ref=$1,updated_at=now() WHERE reference=$1`, reference,paidAt);
    await tx.$executeRawUnsafe(`UPDATE global.renewal_attempts SET status='paid',checked_at=now() WHERE reference=$1`, reference);
    applied=true;
  });
  return { status:'paid',...(applied?{paidAt}:{}) };
}

export async function collectRenewal(input: { tenantId:string; subscriptionId:string; periodEnd:Date; invoiceId:string; amount:number; currency:string; planId:string; cycle:'monthly'|'yearly' }) {
  let charge: { reference:string; authorization:string; email:string } | null = null;
  const result = await prisma.$transaction(async tx => {
    const subs = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.subscriptions WHERE id=$1::uuid FOR UPDATE`, input.subscriptionId);
    const sub = subs[0];
    if (!sub || sub.cancel_at_period_end || +new Date(sub.current_period_end)!==+new Date(input.periodEnd) || +new Date(sub.current_period_end)>Date.now()) return { status:'unpaid' as const,reason:'This billing period is not due.' };
    // Charging the full amount again would overcharge an invoice already part-paid.
    const invs = await tx.$queryRawUnsafe<any[]>(`SELECT amount_paid,status FROM global.invoices WHERE id=$1::uuid`, input.invoiceId);
    if (invs[0] && (invs[0].status !== 'open' || Number(invs[0].amount_paid) > 0)) return { status:'unpaid' as const,reason:'This invoice has been part-paid. Pay the balance in Billing → Invoices.' };
    const auths = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.recurring_consents WHERE tenant_id=$1::uuid AND enabled FOR UPDATE`, input.tenantId);
    const auth = auths[0];
    if (!auth || Number(auth.amount)!==input.amount || auth.currency!==input.currency || auth.plan_id!==input.planId || auth.cycle!==input.cycle) return { status:'unpaid' as const,reason:'Approve automatic renewal at checkout for the current plan and price, or pay manually.' };
    const attempts = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.renewal_attempts WHERE subscription_id=$1::uuid AND period_end=$2::timestamptz ORDER BY attempt DESC LIMIT 1`, input.subscriptionId,input.periodEnd);
    const last = attempts[0];
    if (last?.status==='pending') return { reference:last.reference };
    if (last && (last.status!=='failed' || last.attempt>=3 || +new Date(last.checked_at || last.created_at)+86400000>Date.now())) return { status:'unpaid' as const,reason:'Automatic payment retries are paused. Please use billing settings.' };
    if (Date.now()-+new Date(input.periodEnd)>7*86400000) return { status:'unpaid' as const,reason:'Please renew through billing settings.' };
    const reference = 'CCR-'+crypto.randomUUID().replace(/-/g,'');
    // Committed before the network call. An uncertain send is reconciled, never resent.
    await tx.$executeRawUnsafe(`INSERT INTO global.renewal_attempts(reference,subscription_id,period_end,attempt,invoice_id,tenant_id,amount,currency,email)
      VALUES($1,$2::uuid,$3::timestamptz,$4,$5::uuid,$6::uuid,$7,$8,$9)`, reference,input.subscriptionId,input.periodEnd,(last?.attempt||0)+1,input.invoiceId,input.tenantId,input.amount,input.currency,auth.email);
    await tx.$executeRawUnsafe(`INSERT INTO global.payment_transactions(reference,tenant_id,plan_id,billing_cycle,currency,amount) VALUES($1,$2::uuid,$3::uuid,$4,$5,$6)`,reference,input.tenantId,input.planId,input.cycle,input.currency,input.amount);
    charge = { reference,authorization:decrypt(auth.authorization_enc),email:auth.email };
    return { reference };
  });
  if (!('reference' in result)) return result;
  if (charge) {
    const sending = charge as { reference:string; authorization:string; email:string };
    try { await chargeAuthorization({ authorizationCode:sending.authorization,email:sending.email,amountMajor:input.amount,currency:input.currency,reference:sending.reference,metadata:{kind:'renewal',tenantId:input.tenantId} }); } catch { /* ambiguous outcome: verify this reference only */ }
  }
  return reconcileRenewal(result.reference);
}
