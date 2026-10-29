import { auditCurrentActor } from '../../lib/audit-context';
import { prisma } from '../../config/database';
import { AppError } from '../../lib/errors';
import { periodEnd } from '../billing/billing.service';

// Claim, access period, one-time onboarding receipt and ledger commit together.
// A crash rolls everything back, allowing the same verified reference to retry.
export async function settlePaidCheckout(reference: string, providerRef: string | null, paidAt: Date) {
  if (!Number.isFinite(+paidAt) || +paidAt > Date.now() + 300000) throw new AppError('Invalid payment timestamp.',400,'PAYMENT_MISMATCH');
  const initial = await prisma.$queryRawUnsafe<any[]>(`SELECT tenant_id FROM global.payment_transactions WHERE reference=$1`,reference);
  if (!initial[0]) return null;
  return prisma.$transaction(async tx => {
        await auditCurrentActor(tx);
    await tx.$queryRawUnsafe(`SELECT id FROM global.tenants WHERE id=$1::uuid FOR UPDATE`,initial[0].tenant_id);
    const payments = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.payment_transactions WHERE reference=$1 FOR UPDATE`,reference);
    const payment = payments[0];
    if (!payment || payment.status !== 'pending') return null;
    const plans = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.subscription_plans WHERE id=$1::uuid`,payment.plan_id);
    const plan = plans[0];
    if (!plan) throw new AppError('The paid plan is unavailable. Contact Orion Soft with your payment reference.',409,'PAYMENT_PLAN_UNAVAILABLE');
    const subs = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.subscriptions WHERE tenant_id=$1::uuid FOR UPDATE`,payment.tenant_id);
    const sub = subs[0];
    const same = sub && sub.status !== 'trial' && sub.plan_id === payment.plan_id && sub.billing_cycle === payment.billing_cycle && String(sub.currency).trim() === String(payment.currency).trim();
    const start = same ? new Date(Math.max(+new Date(sub.current_period_end),+paidAt)) : paidAt;
    const end = periodEnd(start,payment.billing_cycle);
    const subscriptionAmount = Number(payment.subscription_amount ?? payment.amount);
    const onboardingFee = Number(payment.onboarding_fee || 0);
    if (Math.round((subscriptionAmount+onboardingFee)*100) !== Math.round(Number(payment.amount)*100)) throw new AppError('Payment breakdown does not match the receipt.',409,'PAYMENT_MISMATCH');
    let subscriptionId = sub?.id;
    if (sub) {
      await tx.$executeRawUnsafe(`UPDATE global.subscriptions SET plan_id=$2::uuid,status='active',billing_cycle=$3,
        current_period_start=$4::timestamptz,current_period_end=$5::timestamptz,trial_ends_at=NULL,cancelled_at=NULL,
        cancel_at_period_end=false,next_invoice_amount=$6,
        coupon_id=CASE WHEN plan_id=$2::uuid AND currency=$7 THEN coupon_id ELSE NULL END,
        discount_percent=CASE WHEN plan_id=$2::uuid AND currency=$7 THEN discount_percent ELSE 0 END,
        discount_fixed=CASE WHEN plan_id=$2::uuid AND currency=$7 THEN discount_fixed ELSE 0 END,
        currency=$7,updated_at=now() WHERE id=$1::uuid`,
        sub.id,payment.plan_id,payment.billing_cycle,start,end,subscriptionAmount,payment.currency);
    } else {
      const created = await tx.$queryRawUnsafe<any[]>(`INSERT INTO global.subscriptions
        (tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,next_invoice_amount,currency)
        VALUES($1::uuid,$2::uuid,'active',$3,$4::timestamptz,$5::timestamptz,$6,$7) RETURNING id`,
        payment.tenant_id,payment.plan_id,payment.billing_cycle,start,end,subscriptionAmount,payment.currency);
      subscriptionId = created[0].id;
    }
    if (onboardingFee > 0) await tx.$executeRawUnsafe(`INSERT INTO global.tenant_onboarding(tenant_id,status,amount,currency,payment_reference,settled_at)
      VALUES($1::uuid,'paid',$2,$3,$4,$5::timestamptz) ON CONFLICT(tenant_id) DO NOTHING`,payment.tenant_id,onboardingFee,payment.currency,reference,paidAt);
    const lineItems = [
      ...(onboardingFee>0 ? [{ description:'One-time implementation & onboarding — Orion Soft Limited',quantity:1,unitAmount:onboardingFee,amount:onboardingFee }] : []),
      {description:`${plan.name} — ${payment.billing_cycle} subscription`,quantity:1,unitAmount:subscriptionAmount,amount:subscriptionAmount},
    ];
    const open = sub && onboardingFee===0 ? await tx.$queryRawUnsafe<any[]>(`SELECT id FROM global.invoices
      WHERE tenant_id=$1::uuid AND subscription_id=$2::uuid AND status='open' AND amount_due=$3 AND currency=$4
        AND billing_period_end >= $5::timestamptz AND billing_period_end <= $6::timestamptz
      ORDER BY created_at LIMIT 1 FOR UPDATE`,payment.tenant_id,sub.id,payment.amount,payment.currency,sub.current_period_end,end) : [];
    if (open[0]) {
      await tx.$executeRawUnsafe(`UPDATE global.invoices SET status='paid',amount_paid=$2,paid_at=$3::timestamptz,
        billing_period_start=$4::timestamptz,billing_period_end=$5::timestamptz,metadata=metadata || $6::jsonb,updated_at=now() WHERE id=$1::uuid`,open[0].id,payment.amount,paidAt,start,end,JSON.stringify({paymentReference:reference}));
    } else {
      await tx.$executeRawUnsafe(`INSERT INTO global.invoices(tenant_id,subscription_id,status,amount_due,amount_paid,currency,
        billing_period_start,billing_period_end,due_date,paid_at,line_items,metadata)
        VALUES($1::uuid,$2::uuid,'paid',$3,$3,$4,$5::timestamptz,$6::timestamptz,$7::timestamptz,$7::timestamptz,$8::jsonb,$9::jsonb)`,
        payment.tenant_id,subscriptionId,payment.amount,payment.currency,start,end,paidAt,JSON.stringify(lineItems),JSON.stringify({paymentReference:reference,onboardingFee,subscriptionAmount}));
    }
    await tx.$executeRawUnsafe(`UPDATE global.payment_transactions SET status='success',processed_at=now(),paid_at=$2::timestamptz,provider_ref=$3,updated_at=now() WHERE reference=$1`,reference,paidAt,providerRef);
    return { tenantId:payment.tenant_id,userId:payment.user_id,planId:payment.plan_id,billingCycle:payment.billing_cycle,
      amount:Number(payment.amount),subscriptionAmount,onboardingFee,currency:String(payment.currency).trim(),recurringConsent:payment.recurring_consent };
  });
}
