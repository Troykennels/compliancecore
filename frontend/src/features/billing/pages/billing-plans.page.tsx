import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, ArrowLeft, Tag, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePublicPlans, useSubscription, useCreateSubscription, useUpdateSubscription, useApplyCoupon, useRemoveCoupon } from '../hooks/use-billing';
import { billingApi } from '../api/billing.api';
import { paymentsApi, type PlanPrice } from '../api/payments.api';
import { PATHS } from '@/routes/paths';
import { SUPPORT_EMAIL, supportMailto } from '@/config/contact';
import type { BillingCycle, SubscriptionPlan } from '../types/billing.types';

const PLAN_HIGHLIGHT: Record<string, boolean> = { professional: true };

/**
 * Plans sold by conversation rather than self-service checkout.
 *
 * Presentation only. These plans still carry a real price server-side, which is
 * what stops anyone assigning themselves Enterprise for free — a zero-priced
 * plan is treated as free by the subscription guard.
 */
const CONTACT_SALES_PLANS = new Set(['enterprise', 'msp']);

const SALES_EMAIL = SUPPORT_EMAIL;

function fmt(amount: number, currency = 'USD'): string {
  if (amount === 0) return 'Free';
  // en-NG renders ₦ correctly; en-US falls back to "NGN 25,000".
  const locale = currency === 'NGN' ? 'en-NG' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Months saved by paying annually, rounded to the nearest whole month.
 *
 * Computed from the prices actually on screen rather than the plan's base
 * currency, so the claim always matches the figures beside it.
 */
function monthsFreeOnAnnual(monthly: number, yearly: number): number {
  if (monthly <= 0 || yearly <= 0) return 0;
  return Math.round((monthly * 12 - yearly) / monthly);
}

function PlanCard({
  plan,
  cycle,
  current,
  onSelect,
  loading,
  prices,
  currency,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  current: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
  loading: boolean;
  prices?: PlanPrice[];
  currency: string;
}) {
  // Prefer the per-currency price; fall back to the plan's own base price so
  // the card still renders correctly before prices load, or on a deployment
  // that has no multi-currency rows.
  const row = prices?.find((p) => p.currency === currency);
  const displayCurrency = row ? row.currency : plan.currency;
  const price = row
    ? cycle === 'monthly' ? row.priceMonthly : row.priceYearly
    : cycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  const highlight = PLAN_HIGHLIGHT[plan.slug];

  const contactSales = CONTACT_SALES_PLANS.has(plan.slug);
  const monthlyShown = row ? row.priceMonthly : plan.priceMonthly;
  const yearlyShown  = row ? row.priceYearly  : plan.priceYearly;
  const monthsFree   = monthsFreeOnAnnual(monthlyShown, yearlyShown);

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
        {contactSales ? (
          <>
            <div className="text-3xl font-extrabold text-slate-900">Contact Sales</div>
            <p className="mt-1 text-xs text-slate-500">
              Priced to your organisation. Talk to us about scope and volume.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-900">{fmt(price, displayCurrency)}</span>
              {price > 0 && (
                <span className="text-sm text-slate-500">/{cycle === 'monthly' ? 'month' : 'year'}</span>
              )}
            </div>
            {cycle === 'yearly' && monthsFree > 0 && (
              <p className="mt-1 text-xs font-medium text-emerald-600">
                {monthsFree} month{monthsFree === 1 ? '' : 's'} free vs paying monthly
              </p>
            )}
            {cycle === 'monthly' && monthsFree > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {fmt(yearlyShown, displayCurrency)}/year — {monthsFree} month{monthsFree === 1 ? '' : 's'} free
              </p>
            )}
          </>
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

      {contactSales ? (
        // Opens the customer's mail client rather than starting checkout: these
        // plans are quoted, not self-served.
        <a
          href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`${plan.name} plan enquiry`)}`}
          className="block w-full rounded-xl bg-slate-900 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-slate-700"
        >
          Contact Sales
        </a>
      ) : (
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
      )}
    </div>
  );
}

export function BillingPlansPage(): JSX.Element {
  const { data: plans = [], isLoading: plansLoading, isError: plansError, refetch } = usePublicPlans();
  const { data: subscription } = useSubscription();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<string>('NGN');
  const [payError, setPayError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponValidation, setCouponValidation] = useState<{ valid: boolean; message: string; discount?: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);

  const { data: paymentConfig } = useQuery({
    queryKey: ['payments', 'config'],
    queryFn: paymentsApi.getConfig,
    staleTime: 5 * 60 * 1000,
  });

  // Per-currency prices for every plan, keyed by plan id. The plan record itself
  // carries only its base currency, so NGN pricing has to come from here.
  const { data: planPrices = {} } = useQuery({
    queryKey: ['payments', 'plan-prices', plans.map((p) => p.id).join(',')],
    enabled: plans.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        plans.map(async (p) => [p.id, await paymentsApi.getPlanPrices(p.id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, PlanPrice[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Default to the first currency the deployment actually supports, rather than
  // assuming NGN — the list is configuration, not a constant.
  useEffect(() => {
    if (paymentConfig?.currencies?.length && !paymentConfig.currencies.includes(currency)) {
      setCurrency(paymentConfig.currencies[0]);
    }
  }, [paymentConfig, currency]);

  // Paystack redirects back here with ?reference=... Confirm it server-side;
  // the endpoint is idempotent, so refreshing this page is harmless.
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const reference = searchParams.get('reference');
    if (!reference) return;
    setConfirming(true);
    paymentsApi
      .confirm(reference)
      .then((r) => {
        setConfirmMsg(
          r.status === 'success'
            ? { ok: true, text: 'Payment successful — your plan is now active.' }
            : { ok: false, text: `Payment ${r.status}. Your plan is unchanged.` },
        );
      })
      .catch(() => setConfirmMsg({ ok: false, text: 'Could not confirm the payment. If you were charged, it will be applied automatically.' }))
      .finally(() => {
        setConfirming(false);
        // Drop the reference so a refresh does not re-run confirmation.
        searchParams.delete('reference');
        setSearchParams(searchParams, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleValidateCoupon() {
    if (!couponInput) return;
    setValidatingCoupon(true);
    try {
      // Validate against the plan the user is (or would be) on, at the selected cycle's
      // real price — not a hardcoded plan/amount.
      const targetPlan =
        plans.find((p) => p.id === subscription?.planId) ??
        plans.find((p) => p.slug === 'professional') ??
        plans[0];
      const targetPrice = targetPlan
        ? cycle === 'monthly' ? targetPlan.priceMonthly : targetPlan.priceYearly
        : 0;
      const res = await billingApi.validateCoupon(couponInput, targetPlan?.slug ?? 'professional', targetPrice);
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
    setPayError(null);
    try {
      // Paid plans go through the payment provider. The subscription is NOT
      // changed here — the backend activates it only after the charge is
      // confirmed server-side, so an abandoned checkout leaves the current plan
      // untouched. Free plans have nothing to charge and switch directly.
      const price = currency === 'NGN'
        ? planPrices[plan.id]?.find((p) => p.currency === 'NGN')
        : planPrices[plan.id]?.find((p) => p.currency === currency);
      const amount = price ? (cycle === 'yearly' ? price.priceYearly : price.priceMonthly) : 0;

      if (paymentConfig?.configured && amount > 0) {
        const checkout = await paymentsApi.createCheckout({
          planId: plan.id,
          currency,
          billingCycle: cycle,
        });
        // Full navigation, not client-side routing: this is Paystack's domain.
        window.location.href = checkout.authorizationUrl;
        return;
      }

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
    } catch (err) {
      // Checkout failures need to surface here — unlike the plan mutations,
      // which render their own error state. The provider's message is the
      // useful one (e.g. "Currency not supported by merchant" before USD is
      // enabled on the account), so show it rather than a generic string.
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setPayError(msg ?? 'Could not start checkout. Please try again.');
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

  if (plansError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-slate-500">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-sm">Failed to load plans.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
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

        {/* Currency selector — only when the deployment can actually take
            payment in more than one currency. */}
        {paymentConfig?.configured && paymentConfig.currencies.length > 1 && (
          <div className="mt-3 inline-flex items-center rounded-xl bg-slate-100 p-1 ml-0 sm:ml-3">
            {paymentConfig.currencies.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                  currency === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {c === 'NGN' ? '₦ NGN' : c === 'USD' ? '$ USD' : c}
              </button>
            ))}
          </div>
        )}

        {/* Payment result, shown after returning from the provider */}
        {confirming && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment…
          </div>
        )}
        {confirmMsg && (
          <div
            className={`mt-4 mx-auto max-w-xl rounded-lg border px-4 py-2.5 text-sm ${
              confirmMsg.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {confirmMsg.text}
          </div>
        )}
        {payError && (
          <div className="mt-4 mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {payError}
          </div>
        )}

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
            prices={planPrices[plan.id]}
            currency={currency}
          />
        ))}
      </div>

      {/* Stated from the selected currency rather than hard-coded. This read
          "All prices in USD" while every plan was priced in naira. */}
      <p className="mt-8 text-center text-xs text-slate-400">
        All prices in {currency}. Enterprise and MSP plans available via{' '}
        <a href={supportMailto('Enterprise / MSP plan enquiry')} className="text-brand-600 hover:underline">
          {SUPPORT_EMAIL}
        </a>.
        Cancel anytime.
      </p>
    </div>
  );
}
