import { auditCurrentActor } from '../../lib/audit-context';
import { prisma } from '../../config/database';
import { AppError } from '../../lib/errors';
export async function reserveCheckout(input: {
  reference:string;tenantId:string;userId:string;planId:string;billingCycle:string;currency:string;
  amount:number;onboardingFee:number;subscriptionAmount:number;recurringConsent?:boolean;
}) {
  return prisma.$transaction(async tx => {
        await auditCurrentActor(tx);
    await tx.$queryRawUnsafe(`SELECT id FROM global.tenants WHERE id=$1::uuid FOR UPDATE`,input.tenantId);
    if (input.onboardingFee>0) {
      const pending = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM global.payment_transactions WHERE tenant_id=$1::uuid AND status='pending' AND onboarding_fee>0 ORDER BY created_at DESC LIMIT 1`,input.tenantId);
      const old = pending[0];
      if (old) {
        const same = old.plan_id===input.planId && old.billing_cycle===input.billingCycle && String(old.currency).trim()===input.currency && Number(old.amount)===input.amount && !!old.recurring_consent===!!input.recurringConsent;
        if (same && old.authorization_url) return {authorizationUrl:old.authorization_url,reference:old.reference,amount:Number(old.amount),currency:String(old.currency).trim()};
        throw new AppError('An onboarding checkout is already open. Complete that checkout before starting another; your onboarding fee will be charged once.',409,'CHECKOUT_PENDING');
      }
      const settled = await tx.$queryRawUnsafe<any[]>(`SELECT status FROM global.tenant_onboarding WHERE tenant_id=$1::uuid`,input.tenantId);
      if (settled.length) throw new AppError('Your onboarding status changed. Refresh the payment summary before paying.',409,'QUOTE_CHANGED');
    }
    await tx.$executeRawUnsafe(`INSERT INTO global.payment_transactions(reference,tenant_id,user_id,plan_id,billing_cycle,currency,amount,onboarding_fee,subscription_amount,recurring_consent,consent_at)
      VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,CASE WHEN $10 THEN now() ELSE NULL END)`,input.reference,input.tenantId,input.userId,input.planId,input.billingCycle,input.currency,input.amount,input.onboardingFee,input.subscriptionAmount,!!input.recurringConsent);
    return null;
  });
}
