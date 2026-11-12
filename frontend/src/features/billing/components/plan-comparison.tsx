import { useState } from 'react';
import { Check, Minus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';
import { PLAN_MODULE_INFO, MODULE_INFO } from '../plan-modules';
import type { SubscriptionPlan } from '../types/billing.types';

/**
 * What each plan on sale includes, module by module (catalogue 2026.2), so the
 * comparison is exact rather than a marketing summary. `focus` is the module a
 * locked page sent the person here for; its row is highlighted. Everything not
 * listed (assessments, controls, policies, evidence, tasks, calendar, expiry
 * tracker, basic reports, branding, billing) is in every plan.
 */
export function PlanComparison({ plans, focus }: { plans: SubscriptionPlan[]; focus: string | null }): JSX.Element | null {
  const role = useAuthStore((s) => s.activeTenant?.role);
  const canBuy = hasPermission(role, 'billing:write');
  const [asked, setAsked] = useState(false);
  const shown = [...plans].filter((p) => p.catalogVersion || p.modules !== undefined).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!shown.length) return null;
  const has = (p: SubscriptionPlan, key: string) => !p.modules || p.modules[key] === true;

  async function ask() {
    try {
      const r = await apiClient.post('/billing/upgrade-request', { module: focus && MODULE_INFO[focus] ? focus : null });
      toast.success(r.data?.data?.message ?? 'Your administrators have been asked.');
      setAsked(true);
    } catch {
      toast.error('The request could not be sent. Please try again.');
    }
  }

  return (
    <section aria-labelledby="plan-compare-title" className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 id="plan-compare-title" className="text-lg font-bold text-slate-900">What each plan includes</h2>
        {!canBuy && (
          <button type="button" onClick={ask} disabled={asked} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Send className="h-4 w-4" aria-hidden="true" /> {asked ? 'Administrators asked' : 'Ask my administrator to upgrade'}
          </button>
        )}
      </div>
      {focus && MODULE_INFO[focus] && (
        <p className="px-5 pt-2 text-sm text-slate-600">Plans that include <strong>{MODULE_INFO[focus].label}</strong> are marked below.</p>
      )}
      <table className="mt-3 w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-5 py-2 font-semibold">Module</th>
            {shown.map((p) => <th key={p.id} scope="col" className="px-3 py-2 text-center font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <th scope="row" className="px-5 py-2 text-left font-medium text-slate-700">Team members</th>
            {shown.map((p) => <td key={p.id} className="px-3 py-2 text-center">{p.maxUsers ?? 'Unlimited'}</td>)}
          </tr>
          <tr className="border-b border-slate-100">
            <th scope="row" className="px-5 py-2 text-left font-medium text-slate-700">Core compliance work, basic reports and your branding</th>
            {shown.map((p) => <td key={p.id} className="px-3 py-2 text-center"><Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Included" /></td>)}
          </tr>
          {PLAN_MODULE_INFO.map((m) => (
            <tr key={m.key} className={focus === m.key ? 'bg-amber-50' : 'border-b border-slate-100'}>
              <th scope="row" className="px-5 py-2 text-left font-medium text-slate-700">
                {m.label}
                {m.key === 'ai' && <span className="block text-xs font-normal text-slate-500">Human review required; not legal advice</span>}
              </th>
              {shown.map((p) => (
                <td key={p.id} className="px-3 py-2 text-center">
                  {has(p, m.key)
                    ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Included" />
                    : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Not included" />}
                  {m.key === 'ai' && has(p, m.key) && p.maxAiRequestsMonthly != null && <span className="block text-xs text-slate-500">{p.maxAiRequestsMonthly}/month</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
