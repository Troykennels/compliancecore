import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, TrendingUp, Check, AlertTriangle } from 'lucide-react';
import { billingApi } from '../api/billing.api';
import type { SubscriptionPlan } from '../types/billing.types';

/**
 * Per-currency pricing and FX drift review.
 *
 * Separate from the Plans tab because a plan record holds only one currency —
 * the naira price a Nigerian customer is actually charged lives in its own
 * table and could not be edited anywhere in the app before this.
 */
export function PricingTab(): JSX.Element {
  const qc = useQueryClient();
  const [currency, setCurrency] = useState('NGN');

  const plansQ = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => (await billingApi.admin.getPlans(true)).data.data,
  });

  const fxQ = useQuery({
    queryKey: ['admin', 'fx-review', currency],
    queryFn: async () => (await billingApi.admin.getFxReview(currency)).data.data,
    // The upstream rate feed updates once a day; refetching on every focus
    // would just re-read the same number.
    staleTime: 30 * 60 * 1000,
  });

  const applyFx = useMutation({
    mutationFn: (planIds: string[]) => billingApi.admin.applyFxSuggestions(planIds, currency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fx-review'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plan-prices'] });
    },
  });

  if (plansQ.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const fx = fxQ.data;
  const drifted = fx?.suggestions.filter((s) => s.needsReview) ?? [];

  return (
    <div className="space-y-6">
      {/* ── FX review ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Exchange rate review</h3>
          </div>
          <button
            onClick={() => fxQ.refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3 w-3 ${fxQ.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {fx?.rate ? (
          <p className="mt-2 text-sm text-slate-600">
            Live rate: <strong>1 USD = ₦{fx.rate.toFixed(2)}</strong>
            <span className="text-slate-400"> · alerts above {fx.thresholdPercent}% drift</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            {fx?.unavailableReason ?? 'Live exchange rate unavailable.'} Prices are unchanged.
          </p>
        )}

        {drifted.length > 0 ? (
          <div className="mt-3 space-y-2">
            {drifted.map((s) => (
              <div
                key={s.planId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="font-semibold text-slate-900">{s.planName}</span>
                <span className="text-slate-600">
                  ${s.usdMonthly}/mo → currently ₦{s.currentMonthly.toLocaleString()}, suggested{' '}
                  <strong>₦{s.suggestedMonthly.toLocaleString()}</strong>
                </span>
                <span className={s.driftPercent > 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {s.driftPercent > 0 ? '+' : ''}
                  {s.driftPercent}%
                </span>
                <button
                  onClick={() => applyFx.mutate([s.planId])}
                  disabled={applyFx.isPending}
                  className="ml-auto rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {applyFx.isPending ? '…' : 'Apply'}
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              Existing subscribers keep the price they signed up at — only new checkouts use the new price.
            </p>
          </div>
        ) : (
          fx?.rate && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="h-4 w-4" /> All prices are within {fx.thresholdPercent}% of their dollar equivalent.
            </p>
          )
        )}
      </div>

      {/* ── Per-currency prices ───────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Prices by currency</h3>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="NGN">NGN (₦)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div className="space-y-3">
          {(plansQ.data ?? []).map((plan) => (
            <PlanPriceRow key={plan.id} plan={plan} currency={currency} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanPriceRow({ plan, currency }: { plan: SubscriptionPlan; currency: string }): JSX.Element {
  const qc = useQueryClient();
  const [monthly, setMonthly] = useState<string>('');
  const [yearly, setYearly] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  const pricesQ = useQuery({
    queryKey: ['admin', 'plan-prices', plan.id],
    queryFn: async () => (await billingApi.admin.getPlanPrices(plan.id)).data.data,
  });

  const row = pricesQ.data?.find((p) => p.currency === currency);
  // Only seed the inputs from the server while the user has not typed — otherwise
  // a background refetch would overwrite what they are editing.
  if (!dirty && row && monthly === '' && yearly === '') {
    setMonthly(String(row.priceMonthly));
    setYearly(String(row.priceYearly));
  }

  const save = useMutation({
    mutationFn: () =>
      billingApi.admin.setPlanPrice(plan.id, {
        currency,
        priceMonthly: Number(monthly || 0),
        priceYearly: Number(yearly || 0),
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin', 'plan-prices', plan.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'fx-review'] });
    },
  });

  const symbol = currency === 'NGN' ? '₦' : '$';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-[140px]">
        <p className="text-sm font-bold text-slate-900">{plan.name}</p>
        <p className="text-xs text-slate-400">{plan.slug}</p>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        Monthly
        <span className="text-slate-400">{symbol}</span>
        <input
          value={monthly}
          onChange={(e) => { setMonthly(e.target.value); setDirty(true); }}
          inputMode="decimal"
          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        Yearly
        <span className="text-slate-400">{symbol}</span>
        <input
          value={yearly}
          onChange={(e) => { setYearly(e.target.value); setDirty(true); }}
          inputMode="decimal"
          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        />
      </label>

      <button
        onClick={() => save.mutate()}
        disabled={!dirty || save.isPending}
        className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
      >
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
      </button>

      {save.isError && <span className="text-xs text-red-600">Could not save</span>}
      {!pricesQ.isLoading && !row && (
        <span className="text-xs text-amber-600">No {currency} price set yet</span>
      )}
    </div>
  );
}
