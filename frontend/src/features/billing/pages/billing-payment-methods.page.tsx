import { useState } from 'react';
import { ArrowLeft, Plus, Star, Trash2, CreditCard, Loader2, Building2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  usePaymentMethods, useAddPaymentMethod, useSetDefaultPaymentMethod, useRemovePaymentMethod,
} from '../hooks/use-billing';
import { PATHS } from '@/routes/paths';
import type { PaymentMethodType, AddPaymentMethodDto } from '../types/billing.types';

// ── Add Payment Method Form ────────────────────────────────────────────────────
function AddPaymentMethodForm({ onCancel }: { onCancel: () => void }) {
  const addPm = useAddPaymentMethod();

  const [type, setType] = useState<PaymentMethodType>('card');
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankLast4, setBankLast4] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: AddPaymentMethodDto = {
      type, label, setAsDefault,
      ...(type === 'card' ? {
        last4: last4 || undefined,
        brand: brand || undefined,
        expMonth: expMonth ? Number(expMonth) : undefined,
        expYear: expYear ? Number(expYear) : undefined,
      } : {
        bankName: bankName || undefined,
        bankAccountLast4: bankLast4 || undefined,
      }),
    };
    addPm.mutate(dto, { onSuccess: onCancel });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Add Payment Method</h3>

      {/* Type selector */}
      <div className="flex gap-2">
        {([
          { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
          { value: 'bank_transfer', label: 'Bank Transfer', icon: <Building2 className="h-4 w-4" /> },
          { value: 'wire', label: 'Wire', icon: <RefreshCw className="h-4 w-4" /> },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
              type === opt.value
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
            }`}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Label *</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            placeholder={type === 'card' ? 'e.g. Visa ending 4242' : 'e.g. Company account'}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {type === 'card' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Card Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select…</option>
                {['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Last 4 digits</label>
              <input
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4242"
                maxLength={4}
                pattern="\d{4}"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Month</label>
              <input
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
                type="number" min="1" max="12"
                placeholder="MM"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Year</label>
              <input
                value={expYear}
                onChange={(e) => setExpYear(e.target.value)}
                type="number" min="2024" max="2040"
                placeholder="YYYY"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {(type === 'bank_transfer' || type === 'wire') && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Barclays"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Account Last 4</label>
              <input
                value={bankLast4}
                onChange={(e) => setBankLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={setAsDefault}
          onChange={(e) => setSetAsDefault(e.target.checked)}
          className="h-4 w-4 rounded text-indigo-600"
        />
        <span className="text-slate-700">Set as default payment method</span>
      </label>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={addPm.isPending || !label}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {addPm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Method'}
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function BillingPaymentMethodsPage(): JSX.Element {
  const { data: pms = [], isLoading, isError, refetch } = usePaymentMethods();
  const setDefault = useSetDefaultPaymentMethod();
  const remove = useRemovePaymentMethod();
  const [showForm, setShowForm] = useState(false);

  const typeIcon: Record<string, string> = { card: '💳', bank_transfer: '🏦', wire: '🔁' };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link to={PATHS.BILLING} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Payment Methods</h1>
          <p className="text-sm text-slate-500">Manage your payment methods for billing</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Method
          </button>
        )}
      </div>

      {showForm && <AddPaymentMethodForm onCancel={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 text-slate-300" />
          <p className="text-sm">Failed to load payment methods.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : pms.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <CreditCard className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">No payment methods on file</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add your first payment method
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pms.map((pm) => (
            <div
              key={pm.id}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                pm.isDefault ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-3xl">{typeIcon[pm.type] ?? '💳'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{pm.label}</span>
                  {pm.isDefault && (
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                      Default
                    </span>
                  )}
                </div>
                {pm.last4 && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {pm.brand} •••• {pm.last4}
                    {pm.expMonth ? ` · Exp ${pm.expMonth}/${pm.expYear}` : ''}
                  </p>
                )}
                {pm.bankName && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {pm.bankName} {pm.bankAccountLast4 ? `···· ${pm.bankAccountLast4}` : ''}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-0.5 capitalize">{pm.type.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!pm.isDefault && (
                  <button
                    onClick={() => setDefault.mutate(pm.id)}
                    disabled={setDefault.isPending}
                    title="Set as default"
                    className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {setDefault.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={() => remove.mutate(pm.id)}
                  disabled={remove.isPending || pm.isDefault}
                  title={pm.isDefault ? 'Cannot remove default method' : 'Remove'}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30"
                >
                  {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-500">
        Payment method details are stored securely. No card numbers are retained — only the last 4 digits and metadata.
      </div>
    </div>
  );
}
