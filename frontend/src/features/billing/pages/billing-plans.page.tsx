import { useState } from 'react';
import { CheckCircle2, Loader2, ArrowLeft, Tag, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePublicPlans, useSubscription, useCreateSubscription, useUpdateSubscription, useApplyCoupon, useRemoveCoupon } from '../hooks/use-billing';
import { billingApi } from '../api/billing.api';
import { PATHS } from '@/routes/paths';
import type { BillingCycle, SubscriptionPlan } from '../types/billing.types';

const PLAN_HIGHLIGHT: Record<string, boolean> = { professional: true };

function fmt(amount: number, currency = 'USD'): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function PlanCard({
  plan,
  cycle,
  current,
  onSelect,
  loading,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  current: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
  loading: boolean;
}) {
  const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  const highlight = PLAN_HIGHLIGHT[plan.slug];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
        highlight
          ? 'border-indigo-500 shadow-lg shadow-indigo-100'
          : current
          ? 'border-emerald-400 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">Most Popular</span>
        </div>
      )}
      {current && (
        <div className="absolute -top-3 right-4">
          <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-white">Current Plan</span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
        <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-900">{fmt(price, plan.currency)}</span>
          {price > 0 && (
            <span className="text-sm text-slate-500">/{cycle === 'monthly' ? 'month' : 'year'}</span>
          )}
        </div>
        {cycle === 'yearly' && plan.priceYearly > 0 && plan.priceMonthly > 0 && (
          <p className="mt-1 text-xs text-emerald-600 font-medium">
            Save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}% vs monthly
          </p>
        )}
      </div>

      <ul className="mb-6 space-y-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      {/* Limits summary */}
      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs space-y-1 text-slate-600">
        <div className="flex justify-between"><span>Team members</span><span className="font-semibold">{plan.maxUsers ?? 'Unlimited'}</span></div>
        <div className="flex justify-between"><span>Frameworks</span><span className="font-semibold">{plan.maxFrameworks ?? 'Unlimited'}</span></div>
        <div className="flex justify-between"><span>Storage</span><span className="font-semibold">{plan.maxEvidenceGb != null ? `${plan.maxEvidenceGb} GB` : 'Unlimited'}</span></div>
      </div>

      <button
        disabled={current || loading}
        onClick={() => onSelect(plan)}
        className={`w-full rounded-xl py-2.5 text-sm font-bold transition-colors ${
          current
            ? 'bg-slate-100 text-slate-400 cursor-default'
            : highlight
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-slate-900 text-white hover:bg-slate-700'
        } disabled:opacity-60`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : current ? 'Current Plan' : 'Select Plan'}
      </button>
    </div>
  );
}

export function BillingPlansPage(): JSX.Element {
  const { data: plans = [], isLoading: plansLoading } = usePublicPlans();
  const { data: subscription } = useSubscription();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [couponInput, setCouponInput] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponValidation, setCouponValidation] = useState<{ valid: boolean; message: string; discount?: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);

  async function handleValidateCoupon() {
    if (!couponInput) return;
    setValidatingCoupon(true);
    try {
      const res = await billingApi.validateCoupon(couponInput, 'professional', 99);
      const v = res.data.data;
      setCouponValidation({
        valid: v.valid,
        message: v.message,
        discount: v.discountedAmount ?? undefined,
      });
    } catch {
      setCouponValidation({ valid: false, message: 'Could not validate coupon' });
    } finally {
      setValidatingCoupon(false);
    }
  }

  async function handleSelectPlan(plan: SubscriptionPlan) {
    setSelectingPlanId(plan.id);
    try {
      if (subscription) {
        await updateSub.mutateAsync({ planId: plan.id, billingCycle: cycle });
        if (couponInput && couponValidation?.valid) {
          await applyCoupon.mutateAsync(couponInput);
        }
      } else {
        await createSub.mutateAsync({
          planId: plan.id,
          billingCycle: cycle,
          couponCode: couponInput && couponValidation?.valid ? couponInput : undefined,
        });
      }
      navigate(PATHS.BILLING);
    } catch {
      // errors shown by mutations
    } finally {
      setSelectingPlanId(null);
    }
  }

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <Link to={PATHS.BILLING} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-900">Choose your plan</h1>
        <p className="mt-2 text-slate-500">Simple, transparent pricing. No hidden fees.</p>

        {/* Billing cycle toggle */}
        <div className="mt-6 inline-flex items-center rounded-xl bg-slate-100 p-1">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition-all ${
                cycle === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c === 'monthly' ? 'Monthly' : 'Yearly'}
              {c === 'yearly' && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">Save 20%</span>}
            </button>
          ))}
        </div>

        {/* Coupon toggle */}
        <div className="mt-4 flex justify-center">
          {!showCoupon ? (
            <button
              onClick={() => setShowCoupon(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Tag className="h-4 w-4" /> Have a coupon code?
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponValidation(null); }}
                placeholder="COUPON CODE"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleValidateCoupon}
                disabled={validatingCoupon || !couponInput}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </button>
              <button onClick={() => { setShowCoupon(false); setCouponInput(''); setCouponValidation(null); }}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          )}
        </div>

        {couponValidation && (
          <p className={`mt-2 text-sm font-medium ${couponValidation.valid ? 'text-emerald-600' : 'text-red-600'}`}>
            {couponValidation.message}
          </p>
        )}
      </div>

      {/* Plan grid */}
      {subscription && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>Currently on <strong>{subscription.planName}</strong> ({subscription.billingCycle}). Select a plan below to change.</span>
          {subscription.couponCode && (
            <button
              onClick={() => removeCoupon.mutate()}
              className="ml-auto flex items-center gap-1 text-xs font-semibold hover:text-red-600"
            >
              Remove coupon <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            current={subscription?.planId === plan.id && subscription?.billingCycle === cycle}
            onSelect={handleSelectPlan}
            loading={selectingPlanId === plan.id}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        All prices in USD. Enterprise and MSP plans available via{' '}
        <a href="mailto:sales@orionsoft.com" className="text-indigo-600 hover:underline">sales@orionsoft.com</a>.
        Cancel anytime.
      </p>
    </div>
  );
}
