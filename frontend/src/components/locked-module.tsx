import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, Send, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';
import { PATHS } from '@/routes/paths';
import { usePublicPlans } from '@/features/billing/hooks/use-billing';
import { MODULE_INFO, useEntitlement } from '@/features/billing/plan-modules';

// Modules with no records of the customer's own (reading IS the feature): no read-only view.
const NO_RECORDS = new Set(['ai', 'analytics', 'policy_templates', 'msp_portfolio']);

const money = (currency: string, n: number) =>
  `${currency === 'NGN' ? 'N' : currency + ' '}${Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

/**
 * Shown on a page whose module the organisation's plan does not include.
 * Says what the module does, which plan includes it and what it costs.
 * People who can pay are sent to Plans and upgrade; everyone else can ask an
 * administrator (they never start a charge). Existing records made under a
 * higher plan stay viewable, read-only; the API refuses any change.
 */
export function LockedModulePage({ module, children }: { module: string; children: React.ReactNode }): JSX.Element {
  const info = MODULE_INFO[module];
  const role = useAuthStore((s) => s.activeTenant?.role);
  const canBuy = hasPermission(role, 'billing:write');
  const { data: ent } = useEntitlement();
  const { data: plans = [] } = usePublicPlans();
  const [viewing, setViewing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);

  // The smallest plan on sale that includes this module (no module list = every module).
  const unlockedBy = [...plans]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((p) => !p.modules || p.modules[module] === true);

  async function ask() {
    setAsking(true);
    try {
      const r = await apiClient.post('/billing/upgrade-request', { module });
      toast.success(r.data?.data?.message ?? 'Your administrators have been asked.');
      setAsked(true);
    } catch {
      toast.error('The request could not be sent. Please try again.');
    } finally {
      setAsking(false);
    }
  }

  if (viewing) {
    return (
      <>
        <div role="status" className="mx-6 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{info?.label ?? 'This module'} is read-only on your plan: you can view and export existing records, but not add or change them.</span>
          {canBuy && <Link to={`${PATHS.BILLING_PLANS}?module=${module}`} className="font-semibold underline">Upgrade</Link>}
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-5 w-5 text-slate-600" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{info?.label ?? 'This module'} is not in your {ent?.planName ?? 'current'} plan</h1>
      {info && <p className="mt-2 text-sm text-slate-600">{info.benefit}</p>}
      {unlockedBy && (
        <p className="mt-3 text-sm text-slate-700">
          Included from <strong>{unlockedBy.name}</strong>
          {unlockedBy.slug.startsWith('enterprise')
            ? ' (quoted by Orion Soft Limited)'
            : `: ${money(unlockedBy.currency, unlockedBy.priceMonthly)} a month or ${money(unlockedBy.currency, unlockedBy.priceYearly)} a year`}.
          {' '}The total, including any onboarding, is shown before you pay.
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {canBuy ? (
          <Link to={`${PATHS.BILLING_PLANS}?module=${module}`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Upgrade plan
          </Link>
        ) : (
          <button type="button" onClick={ask} disabled={asking || asked} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <Send className="h-4 w-4" aria-hidden="true" /> {asked ? 'Administrators asked' : asking ? 'Sending...' : 'Ask my administrator'}
          </button>
        )}
        {!NO_RECORDS.has(module) && <button type="button" onClick={() => setViewing(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Eye className="h-4 w-4" aria-hidden="true" /> View existing records
        </button>}
      </div>
      <p className="mt-4 text-xs text-slate-500">Nothing recorded is removed or hidden by a plan change.</p>
    </div>
  );
}
