import { prisma } from '../../config/database';
import * as billingRepo from '../billing/billing.repository';
import * as repo from './payments.repository';
import { applyDiscount } from '../billing/billing.service';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { CONTACT_SALES_PLANS } from '../billing/billing.types';

export async function checkoutQuote(input: { tenantId: string; planId: string; currency: string; billingCycle: 'monthly' | 'yearly' }) {
  const plan = await billingRepo.findPlanById(input.planId);
  if (!plan || !plan.isActive) throw new NotFoundError('Active plan');
  // Withdrawn plans (not on sale) and quoted plans (Enterprise, MSP) can only be
  // paid for by an organisation already on them: a grandfathered customer
  // renews its contracted plan, but nobody can buy an old cheaper plan or a
  // quoted one by sending its id.
  const current = await billingRepo.findSubscriptionByTenant(input.tenantId);
  if (current?.planId !== plan.id && (!plan.isPublic || (CONTACT_SALES_PLANS as readonly string[]).includes(plan.slug))) {
    throw new AppError(
      (CONTACT_SALES_PLANS as readonly string[]).includes(plan.slug)
        ? `${plan.name} is arranged with Orion Soft Limited. Contact us for a quotation.`
        : `${plan.name} is no longer offered to new subscriptions. Choose one of the current plans.`,
      403, 'PLAN_NOT_AVAILABLE');
  }
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
  // An agreed discount belongs to the current plan, not an arbitrary upgrade.
  const subscriptionAmount = contracted ? sub.nextInvoiceAmount : sub?.planId === plan.id && sub.currency === currency ? applyDiscount(base,sub.discountPercent,sub.discountFixed) : base;
  // Plans marked waive_onboarding_yearly charge no onboarding to a customer who
  // pays a year upfront (the payment then settles onboarding as covered).
  const onboardingWaived = onboardingRequired && input.billingCycle === 'yearly' && plan.waiveOnboardingYearly === true && price.onboardingFee > 0;
  const onboardingFee = onboardingRequired && !onboardingWaived ? price.onboardingFee : 0;
  return { planId:plan.id,planName:plan.name,currency,billingCycle:input.billingCycle,subscriptionAmount,onboardingFee,total:Math.round((subscriptionAmount+onboardingFee)*100)/100,onboardingRequired,onboardingWaived,previewOnly };
}
