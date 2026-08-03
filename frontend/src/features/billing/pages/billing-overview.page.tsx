import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle, Pause,
  ChevronRight, Download, Tag, X, Loader2, Plus, Trash2, Star, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBillingOverview, useApplyCoupon, useRemoveCoupon, useRemovePaymentMethod, useSetDefaultPaymentMethod } from '../hooks/use-billing';
import { PATHS } from '@/routes/paths';
import type { SubscriptionStatus, InvoiceStatus, PaymentMethod } from '../types/billing.types';
import { billingApi } from '../api/billing.api';
import { useOrgFormat } from '@/lib/org-format';

// ── Status helpers ─────────────────────────────────────────────────────────────
function SubStatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<SubscriptionStatus, { label: string; cls: string; icon: JSX.Element }> = {
    active:   { label: 'Active',    cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    trial:    { label: 'Trial',     cls: 'bg-blue-100 text-blue-700',      icon: <Clock className="h-3 w-3" /> },
    past_due: { label: 'Past Due',  cls: 'bg-amber-100 text-amber-700',    icon: <AlertTriangle className="h-3 w-3" /> },
    cancelled:{ label: 'Cancelled', cls: 'bg-red-100 text-red-700',        icon: <XCircle className="h-3 w-3" /> },
    paused:   { label: 'Paused',    cls: 'bg-slate-100 text-slate-600',    icon: <Pause className="h-3 w-3" /> },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function InvStatusBadge({ status }: { status: InvoiceStatus }) {
  const cls: Record<InvoiceStatus, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    open: 'bg-blue-100 text-blue-700',
    draft: 'bg-slate-100 text-slate-600',
    void: 'bg-slate-100 text-slate-400',
    uncollectible: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${cls[status]}`}>
      {status}
    </span>
  );
}

// ── Usage bar ──────────────────────────────────────────────────────────────────
function UsageBar({ label, current, limit, pct, over }: {
  label: string; current: number; limit: number | null; pct: number | null; over: boolean;
}) {
  const color = over ? 'bg-red-500' : pct !== null && pct > 80 ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-semibold ${over ? 'text-red-600' : 'text-slate-600'}`}>
          {current.toFixed(current < 10 ? 2 : 0)}{limit !== null ? ` / ${limit}` : ' (unlimited)'}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(100, pct ?? 0)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── Coupon row ─────────────────────────────────────────────────────────────────
function CouponSection({ couponCode, discountPercent, discountFixed }: {
  couponCode: string | null; discountPercent: number; discountFixed: number;
}) {
  const [couponInput, setCouponInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();

  if (couponCode) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
        <Tag className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Coupon <strong>{couponCode}</strong> applied</span>
        {discountPercent > 0 && <span className="text-xs text-emerald-600">({discountPercent}% off)</span>}
        {discountFixed > 0 && <span className="text-xs text-emerald-600">(-${discountFixed} off)</span>}
        <button
          onClick={() => removeCoupon.mutate()}
          disabled={removeCoupon.isPending}
          className="ml-auto text-emerald-600 hover:text-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="flex gap-2">
        <input
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
          placeholder="COUPON CODE"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => applyCoupon.mutate(couponInput, { onSuccess: () => setShowInput(false) })}
          disabled={applyCoupon.isPending || !couponInput}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {applyCoupon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </button>
        <button onClick={() => setShowInput(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
    >
      <Tag className="h-3.5 w-3.5" /> Have a coupon code?
    </button>
  );
}

// ── Payment method card ────────────────────────────────────────────────────────
function PmCard({ pm }: { pm: PaymentMethod }) {
  const setDefault = useSetDefaultPaymentMethod();
  const remove = useRemovePaymentMethod();

  const icon = pm.type === 'card' ? '💳' : pm.type === 'bank_transfer' ? '🏦' : '🔁';
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${pm.isDefault ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{pm.label}</span>
          {pm.isDefault && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">DEFAULT</span>
          )}
        </div>
        {pm.last4 && (
          <p className="text-xs text-slate-500">
            {pm.brand ?? ''} •••• {pm.last4}
            {pm.expMonth && ` · Expires ${pm.expMonth}/${pm.expYear}`}
          </p>
        )}
        {pm.bankName && <p className="text-xs text-slate-500">{pm.bankName} ···· {pm.bankAccountLast4}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!pm.isDefault && (
          <button
            onClick={() => setDefault.mutate(pm.id)}
            disabled={setDefault.isPending}
            title="Set as default"
            className="rounded p-1 text-slate-400 hover:text-indigo-600"
          >
            <Star className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => remove.mutate(pm.id)}
          disabled={remove.isPending}
          title="Remove"
          className="rounded p-1 text-slate-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Query error state ──────────────────────────────────────────────────────────
function QueryError({ onRetry, message = 'Something went wrong while loading this page.' }: {
  onRetry: () => void; message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-500">
      <AlertTriangle className="h-10 w-10 text-slate-300" />
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

// ── Main page ──────────────────────────────────────────────────────────────────
export function BillingOverviewPage(): JSX.Element {
  const fmt = useOrgFormat();
  const { data: overview, isLoading, isError, refetch } = useBillingOverview();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(id: string, number: string) {
    setDownloading(id);
    try {
      await billingApi.downloadInvoicePdf(id, number);
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setDownloading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <QueryError onRetry={() => refetch()} message="Failed to load billing details." />
      </div>
    );
  }

  const { subscription: sub, plan, paymentMethods: pms, recentInvoices, usage } = overview;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your subscription, payment methods, and invoices</p>
        </div>
        <Link
          to={PATHS.BILLING_PLANS}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <CreditCard className="h-4 w-4" /> Change Plan
        </Link>
      </div>

      {/* Subscription card */}
      <Card title="Current Subscription">
        {sub && plan ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <SubStatusBadge status={sub.status} />
                  {sub.cancelAtPeriodEnd && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      Cancels at period end
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-slate-900">
                  ${(sub.nextInvoiceAmount ?? 0).toFixed(2)}
                  <span className="text-sm font-normal text-slate-500">/{sub.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </p>
                {sub.discountPercent > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">{sub.discountPercent}% discount applied</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-slate-500">Billing Cycle</p>
                <p className="font-semibold text-slate-800 capitalize">{sub.billingCycle}</p>
              </div>
              <div>
                <p className="text-slate-500">Current Period</p>
                <p className="font-semibold text-slate-800">
                  {fmt.formatDate(sub.currentPeriodStart)} –{' '}
                  {fmt.formatDate(sub.currentPeriodEnd)}
                </p>
              </div>
              {sub.trialEndsAt && (
                <div>
                  <p className="text-slate-500">Trial Ends</p>
                  <p className="font-semibold text-slate-800">{fmt.formatDate(sub.trialEndsAt)}</p>
                </div>
              )}
              {sub.cancelledAt && (
                <div>
                  <p className="text-slate-500">Cancelled At</p>
                  <p className="font-semibold text-red-700">{fmt.formatDate(sub.cancelledAt)}</p>
                </div>
              )}
            </div>

            <CouponSection couponCode={sub.couponCode} discountPercent={sub.discountPercent} discountFixed={sub.discountFixed} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CreditCard className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No active subscription</p>
            <Link
              to={PATHS.BILLING_PLANS}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Choose a Plan
            </Link>
          </div>
        )}
      </Card>

      {/* Usage limits */}
      {usage && usage.length > 0 && (
        <Card title="Usage Limits">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {usage.map((u) => (
              <UsageBar
                key={u.metric}
                label={u.label}
                current={u.currentValue}
                limit={u.limitValue}
                pct={u.usagePercent}
                over={u.isOverLimit}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Payment methods */}
      <Card
        title="Payment Methods"
        action={
          <Link
            to={PATHS.BILLING_PAYMENT_METHODS}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="h-3.5 w-3.5" /> Add Method
          </Link>
        }
      >
        {pms && pms.length > 0 ? (
          <div className="space-y-2">
            {pms.map((pm) => <PmCard key={pm.id} pm={pm} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">No payment methods on file</p>
        )}
      </Card>

      {/* Recent invoices */}
      <Card
        title="Recent Invoices"
        action={
          <Link to={PATHS.BILLING_INVOICES} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {recentInvoices && recentInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="pb-2 text-left font-medium">Number</th>
                  <th className="pb-2 text-left font-medium">Period</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-center font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 font-mono text-xs text-slate-700">{inv.number}</td>
                    <td className="py-2.5 text-xs text-slate-500">
                      {fmt.formatMonthYear(inv.billingPeriodStart)}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">
                      {inv.currency} {inv.amountDue.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      <InvStatusBadge status={inv.status} />
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDownload(inv.id, inv.number)}
                        disabled={downloading === inv.id}
                        className="text-slate-400 hover:text-indigo-600"
                        title="Download PDF"
                      >
                        {downloading === inv.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Download className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">No invoices yet</p>
        )}
      </Card>
    </div>
  );
}
