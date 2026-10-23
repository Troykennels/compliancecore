import { prisma } from '../../config/database';
import * as billingRepo from '../billing/billing.repository';
import * as repo from './payments.repository';
import { applyDiscount } from '../billing/billing.service';
import { NotFoundError, ValidationError } from '../../lib/errors';

export async function checkoutQuote(input: { tenantId: string; planId: string; currency: string; billingCycle: 'monthly' | 'yearly' }) {
  const plan = await billingRepo.findPlanById(input.planId);
  if (!plan || !plan.isActive) throw new NotFoundError('Active plan');
  const currency = input.currency.toUpperCase();
  const price = await repo.findPlanPrice(plan.id, currency);
  if (!price) throw new ValidationError(`No price is configured in ${currency}. Contact Orion Soft Limited.`);
  const onboarding = await prisma.$queryRawUnsafe<{status:string}[]>(`SELECT status FROM global.tenant_onboarding WHERE tenant_id=$1::uuid`,input.tenantId);
  const previewOnly = onboarding[0]?.status === 'demo';
  const onboardingRequired = previewOnly || !onboarding.length;
  if (onboardingRequired && Number(plan.onboardingFee)>0 && !price.onboardingFee) throw new ValidationError(`Onboarding pricing in ${currency} needs a quotation. Choose NGN or contact Orion Soft Limited.`);
  const sub = await billingRepo.findSubscriptionByTenant(input.tenantId);
  const contracted = !previewOnly && sub && sub.status !== 'trial' && sub.planId === plan.id && sub.billingCycle === input.billingCycle && sub.currency === currency && sub.nextInvoiceAmount > 0;
  const base = input.billingCycle === 'yearly' ? price.priceYearly : price.priceMonthly;
  const subscriptionAmount = contracted ? sub.nextInvoiceAmount : sub?.currency === currency ? applyDiscount(base,sub.discountPercent,sub.discountFixed) : base;
  const onboardingFee = onboardingRequired ? price.onboardingFee : 0;
  return { planId:plan.id,planName:plan.name,currency,billingCycle:input.billingCycle,subscriptionAmount,onboardingFee,total:Math.round((subscriptionAmount+onboardingFee)*100)/100,onboardingRequired,previewOnly };
}
