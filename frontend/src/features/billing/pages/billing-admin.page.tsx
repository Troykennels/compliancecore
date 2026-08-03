import { useState } from 'react';
import {
  ShieldAlert, Tag, Building2, FileText, Plus, Edit2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, Loader2, Download, AlertTriangle, RefreshCw, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { PricingTab } from '../components/pricing-tab';
import {
  useAdminPlans, useAdminCreatePlan, useAdminUpdatePlan,
  useAdminCoupons, useAdminCreateCoupon, useAdminUpdateCoupon,
  useAdminTenantBilling, useAdminInvoices, useAdminUpdateInvoice,
} from '../hooks/use-billing';
import { billingApi } from '../api/billing.api';
import type {
  CreatePlanDto, CreateCouponDto, PlanSlug,
} from '../types/billing.types';
import { useOrgFormat } from '@/lib/org-format';

// ── Tab definitions ────────────────────────────────────────────────────────────
type Tab = 'plans' | 'pricing' | 'coupons' | 'tenants' | 'invoices';
const TABS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  { id: 'plans',   label: 'Plans',    icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'pricing', label: 'Pricing',  icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'coupons', label: 'Coupons',  icon: <Tag className="h-4 w-4" /> },
  { id: 'tenants', label: 'Tenants',  icon: <Building2 className="h-4 w-4" /> },
  { id: 'invoices',label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
];

// ── Query error state ────────────────────────────────────────────────────────────
function QueryError({ onRetry, message = 'Failed to load data.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-500">
      <AlertTriangle className="h-8 w-8 text-slate-300" />
      <p className="text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  );
}

// ── Shared field wrapper ─────────────────────────────────────────────────────────
// Declared at module scope so it keeps a stable identity across renders — declaring
// it inside a component remounts every input on each keystroke (focus loss).
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Plans tab ──────────────────────────────────────────────────────────────────
function PlanForm({ initial, onDone }: {
  initial?: Partial<CreatePlanDto & { id: string; isActive: boolean }>;
  onDone: () => void;
}) {
  const createPlan = useAdminCreatePlan();
  const updatePlan = useAdminUpdatePlan();
  const isEdit = Boolean(initial?.id);

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.slug ?? 'starter' as PlanSlug,
    description: initial?.description ?? '',
    priceMonthly: String(initial?.priceMonthly ?? 0),
    priceYearly: String(initial?.priceYearly ?? 0),
    maxUsers: initial?.maxUsers != null ? String(initial.maxUsers) : '',
    maxFrameworks: initial?.maxFrameworks != null ? String(initial.maxFrameworks) : '',
    maxEvidenceGb: initial?.maxEvidenceGb != null ? String(initial.maxEvidenceGb) : '',
    featuresRaw: (initial?.features ?? []).join('\n'),
    isPublic: initial?.isPublic ?? true,
    sortOrder: String(initial?.sortOrder ?? 0),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: CreatePlanDto = {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly),
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
      maxFrameworks: form.maxFrameworks ? Number(form.maxFrameworks) : null,
      maxEvidenceGb: form.maxEvidenceGb ? Number(form.maxEvidenceGb) : null,
      features: form.featuresRaw.split('\n').map((s) => s.trim()).filter(Boolean),
      isPublic: form.isPublic,
      sortOrder: Number(form.sortOrder),
    };

    if (isEdit && initial?.id) {
      updatePlan.mutate({ id: initial.id, dto }, { onSuccess: onDone });
    } else {
      createPlan.mutate(dto, { onSuccess: onDone });
    }
  }

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/20 p-5">
      <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit Plan' : 'Create Plan'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inp} /></F>
        <F label="Slug *">
          <select value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value as PlanSlug })} className={inp}>
            {['starter','professional','enterprise','msp'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </F>
        <F label="Monthly Price (USD)"><input type="number" step="0.01" min="0" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} required className={inp} /></F>
        <F label="Yearly Price (USD)"><input type="number" step="0.01" min="0" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} required className={inp} /></F>
        <F label="Max Users (blank = unlimited)"><input type="number" min="1" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} placeholder="Unlimited" className={inp} /></F>
        <F label="Max Frameworks"><input type="number" min="1" value={form.maxFrameworks} onChange={(e) => setForm({ ...form, maxFrameworks: e.target.value })} placeholder="Unlimited" className={inp} /></F>
        <F label="Max Evidence GB"><input type="number" step="0.1" min="0" value={form.maxEvidenceGb} onChange={(e) => setForm({ ...form, maxEvidenceGb: e.target.value })} placeholder="Unlimited" className={inp} /></F>
        <F label="Sort Order"><input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inp} /></F>
        <div className="sm:col-span-2">
          <F label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} /></F>
        </div>
        <div className="sm:col-span-2">
          <F label="Features (one per line)">
            <textarea
              value={form.featuresRaw}
              onChange={(e) => setForm({ ...form, featuresRaw: e.target.value })}
              rows={4}
              className={inp}
            />
          </F>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="h-4 w-4 rounded text-indigo-600" />
        <span className="text-slate-700">Show on public plans page</span>
      </label>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={createPlan.isPending || updatePlan.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {createPlan.isPending || updatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
}

function PlansTab() {
  const { data: plans = [], isLoading, isError, refetch } = useAdminPlans();
  const updatePlan = useAdminUpdatePlan();
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;
  if (isError) return <QueryError onRetry={() => refetch()} message="Failed to load plans." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>
      {showCreate && <PlanForm onDone={() => setShowCreate(false)} />}
      <div className="grid gap-3">
        {plans.map((plan) => (
          <div key={plan.id}>
            {editId === plan.id ? (
              <PlanForm initial={{ ...plan }} onDone={() => setEditId(null)} />
            ) : (
              <div className={`flex items-center gap-4 rounded-xl border p-4 ${plan.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{plan.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{plan.slug}</span>
                    {!plan.isActive && <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-semibold">Inactive</span>}
                    {!plan.isPublic && <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold">Hidden</span>}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>${plan.priceMonthly}/mo · ${plan.priceYearly}/yr</span>
                    <span>Users: {plan.maxUsers ?? '∞'}</span>
                    <span>Frameworks: {plan.maxFrameworks ?? '∞'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditId(plan.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => updatePlan.mutate({ id: plan.id, dto: { isActive: !plan.isActive } })}
                    disabled={updatePlan.isPending}
                    className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${plan.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={plan.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {plan.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Coupons tab ────────────────────────────────────────────────────────────────
function CouponForm({ onDone }: { onDone: () => void }) {
  const create = useAdminCreateCoupon();
  const [form, setForm] = useState({
    code: '',
    name: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '10',
    maxUses: '',
    minAmount: '0',
    expiresAt: '',
    applicableSlugs: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: CreateCouponDto = {
      code: form.code.toUpperCase(),
      name: form.name,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      minAmount: Number(form.minAmount),
      expiresAt: form.expiresAt || null,
      applicablePlanSlugs: form.applicableSlugs ? form.applicableSlugs.split(',').map((s) => s.trim()) : [],
    };
    create.mutate(dto, { onSuccess: onDone });
  }

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/20 p-5">
      <h3 className="font-semibold text-slate-900">Create Coupon</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Code *</label>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required className={`${inp} font-mono uppercase`} placeholder="SUMMER20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inp} placeholder="Summer Discount" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Discount Type</label>
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })} className={inp}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Discount Value *</label>
          <input type="number" step="0.01" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Max Uses (blank = unlimited)</label>
          <input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Min Amount ($)</label>
          <input type="number" step="0.01" min="0" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Expires At</label>
          <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Applicable Plans (comma-separated slugs)</label>
          <input value={form.applicableSlugs} onChange={(e) => setForm({ ...form, applicableSlugs: e.target.value })} placeholder="professional,enterprise" className={inp} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={create.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Coupon'}
        </button>
      </div>
    </form>
  );
}

function CouponsTab() {
  const fmt = useOrgFormat();
  const { data: coupons = [], isLoading, isError, refetch } = useAdminCoupons(true);
  const updateCoupon = useAdminUpdateCoupon();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;
  if (isError) return <QueryError onRetry={() => refetch()} message="Failed to load coupons." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> New Coupon
        </button>
      </div>
      {showCreate && <CouponForm onDone={() => setShowCreate(false)} />}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Discount</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Uses</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Expires</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Toggle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {coupons.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50 ${!c.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-slate-800">{c.code}</td>
                <td className="px-4 py-3 text-xs">
                  {c.discountType === 'percentage' ? `${c.discountValue}% off` : `$${c.discountValue} off`}
                  {c.minAmount > 0 && <span className="text-slate-400 ml-1">(min ${c.minAmount})</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-600">
                  {c.usesCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {c.expiresAt ? fmt.formatDate(c.expiresAt) : 'Never'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => updateCoupon.mutate({ id: c.id, dto: { isActive: !c.isActive } })}
                    disabled={updateCoupon.isPending}
                    className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${c.isActive ? 'text-emerald-600 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                  >
                    {c.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Tag className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">No coupons yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tenants tab ────────────────────────────────────────────────────────────────
function TenantsTab() {
  const fmt = useOrgFormat();
  const { data: tenants = [], isLoading, isError, refetch } = useAdminTenantBilling();
  const [search, setSearch] = useState('');

  const filtered = tenants.filter((t) =>
    !search || t.tenantName.toLowerCase().includes(search.toLowerCase()) || t.tenantSlug.toLowerCase().includes(search.toLowerCase()),
  );

  const STATUS_CLS: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    trial: 'bg-blue-100 text-blue-700',
    past_due: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-600',
    paused: 'bg-slate-100 text-slate-500',
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;
  if (isError) return <QueryError onRetry={() => refetch()} message="Failed to load tenant billing." />;

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tenants…"
        className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Period End</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Next Invoice</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Invoiced</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((t) => (
              <tr key={t.tenantId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{t.tenantName}</p>
                  <p className="text-xs text-slate-400 font-mono">{t.tenantSlug}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 capitalize">{t.planName ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  {t.subscriptionStatus ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[t.subscriptionStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.subscriptionStatus}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {t.currentPeriodEnd ? fmt.formatDate(t.currentPeriodEnd) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
                  {t.nextInvoiceAmount != null ? `${t.currency} ${t.nextInvoiceAmount.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-600">
                  {t.currency} {t.totalInvoiced.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-emerald-700">
                  {t.currency} {t.totalPaid.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">No tenants found</p>
        )}
      </div>
    </div>
  );
}

// ── Invoices tab ───────────────────────────────────────────────────────────────
function AdminInvoicesTab() {
  const fmt = useOrgFormat();
  const { data: invoices = [], isLoading, isError, refetch } = useAdminInvoices({ limit: 100 });
  const updateInvoice = useAdminUpdateInvoice();
  const [downloading, setDownloading] = useState<string | null>(null);

  const STATUS_CLS: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700', open: 'bg-blue-100 text-blue-700',
    draft: 'bg-slate-100 text-slate-500', void: 'bg-slate-100 text-slate-400',
    uncollectible: 'bg-red-100 text-red-600',
  };

  async function download(id: string) {
    setDownloading(id);
    try { await billingApi.admin.downloadInvoicePdf(id); } catch { toast.error('Download failed'); } finally { setDownloading(null); }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;
  if (isError) return <QueryError onRetry={() => refetch()} message="Failed to load invoices." />;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Number</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tenant</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Period</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{inv.number}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{inv.tenantName ?? inv.tenantId}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {fmt.formatMonthYear(inv.billingPeriodStart)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {inv.currency} {inv.amountDue.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[inv.status]}`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  {inv.status === 'open' && (
                    <button
                      onClick={() => updateInvoice.mutate({ id: inv.id, dto: { status: 'paid', amountPaid: inv.amountDue, paidAt: new Date().toISOString() } })}
                      className="rounded p-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-1"
                      title="Mark as paid"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {inv.status !== 'void' && inv.status !== 'paid' && (
                    <button
                      onClick={() => updateInvoice.mutate({ id: inv.id, dto: { status: 'void' } })}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Void invoice"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => download(inv.id)}
                    disabled={downloading === inv.id}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Download PDF"
                  >
                    {downloading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {invoices.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No invoices found</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function BillingAdminPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
          <ShieldAlert className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing Admin</h1>
          <p className="text-sm text-slate-500">Platform-level billing management — superadmin only</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans'    && <PlansTab />}
      {tab === 'pricing'  && <PricingTab />}
      {tab === 'coupons'  && <CouponsTab />}
      {tab === 'tenants'  && <TenantsTab />}
      {tab === 'invoices' && <AdminInvoicesTab />}
    </div>
  );
}
