import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ArrowLeft, Download, Search, Loader2, FileText, AlertTriangle, RefreshCw, CreditCard } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useInvoices } from '../hooks/use-billing';
import { billingApi } from '../api/billing.api';
import { paymentsApi } from '../api/payments.api';
import type { Invoice } from '../types/billing.types';
import { PATHS } from '@/routes/paths';
import type { InvoiceStatus } from '../types/billing.types';
import { useOrgFormat } from '@/lib/org-format';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
  { value: 'uncollectible', label: 'Uncollectible' },
];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  open: 'bg-blue-100 text-blue-700',
  draft: 'bg-slate-100 text-slate-500',
  void: 'bg-slate-100 text-slate-400 line-through',
  uncollectible: 'bg-red-100 text-red-600',
};

export function BillingInvoicesPage(): JSX.Element {

  const fmt = useOrgFormat();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: invoices = [], isLoading, isError, refetch } = useInvoices({
    status: statusFilter || undefined,
    limit: 100,
  });

  const filtered = invoices.filter((inv) =>
    !search ||
    inv.number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.tenantName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  // Paystack returns here with ?reference=…; confirmation is idempotent.
  useEffect(() => {
    const reference = searchParams.get('reference');
    if (!reference) return;
    paymentsApi.confirm(reference)
      .then((r) => setConfirmMsg(r.status === 'success'
        ? { ok: true, text: 'Payment received and added to the invoice. If a balance remains, you can pay it here whenever you are ready.' }
        : { ok: false, text: r.status === 'failed' ? 'That payment did not go through. You can try again.' : 'Your payment is still being confirmed. You do not need to pay again.' }))
      .catch(() => setConfirmMsg({ ok: false, text: 'Could not confirm the payment yet. If you were charged, it will be applied automatically.' }))
      .finally(() => { void refetch(); searchParams.delete('reference'); setSearchParams(searchParams, { replace: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanceOf = (inv: Invoice) => Math.max(0, Math.round((inv.amountDue - inv.amountPaid) * 100) / 100);

  async function startPayment() {
    if (!paying) return;
    const value = part ? Number(amount) : undefined;
    if (part && !(value! > 0)) { toast.error('Enter the amount you want to pay now'); return; }
    setStarting(true);
    try {
      const result = await paymentsApi.invoiceCheckout({ invoiceId: paying.id, amount: value });
      const target = new URL(result.authorizationUrl);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.paystack.com') throw new Error('Invalid checkout link');
      window.location.assign(target.href);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || 'Could not start the payment. Please try again.');
      setStarting(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-5">
      {/* Header */}
      <PageHeader eyebrow="Billing" title="Invoices" description="Download invoices and pay open ones in full or in parts."
        actions={<Link to={PATHS.BILLING} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Billing overview</Link>} />

      {confirmMsg && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm ${confirmMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{confirmMsg.text}</div>
      )}

      {paying && (
        <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm space-y-3" role="dialog" aria-label={`Pay invoice ${paying.number}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Pay invoice {paying.number}</h2>
            <p className="text-sm text-slate-600">Paid {paying.currency} {paying.amountPaid.toFixed(2)} of {paying.currency} {paying.amountDue.toFixed(2)} · balance <strong>{paying.currency} {balanceOf(paying).toFixed(2)}</strong></p>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">How much to pay</legend>
            <label className="flex items-center gap-2"><input type="radio" name="howmuch" checked={!part} onChange={() => setPart(false)} /> The full balance ({paying.currency} {balanceOf(paying).toFixed(2)})</label>
            <label className="flex items-center gap-2"><input type="radio" name="howmuch" checked={part} onChange={() => setPart(true)} /> Part now, the rest later</label>
          </fieldset>
          {part && (
            <label className="block text-sm text-slate-600">Amount to pay now ({paying.currency})
              <input type="number" inputMode="decimal" min={Math.min(100, balanceOf(paying))} max={balanceOf(paying)} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
          )}
          <p className="text-xs text-slate-500">Every payment, full or part, is added to this invoice and its balance updates straight away. Payment is processed securely by Paystack.</p>
          <div className="flex gap-2">
            <button onClick={() => void startPayment()} disabled={starting} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {part ? 'Pay this amount' : 'Pay full balance'}
            </button>
            <button onClick={() => setPaying(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
           aria-label="Search invoices…" />
        </div>
        <select
          aria-label="Filter invoices by status" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
            <AlertTriangle className="h-8 w-8 text-slate-300" />
            <p className="text-sm">Failed to load invoices.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">No invoices found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{inv.number}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {fmt.formatDateMedium(inv.billingPeriodStart)}
                    {' – '}
                    {fmt.formatDateMedium(inv.billingPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {fmt.formatDate(inv.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {inv.currency} {inv.amountDue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-emerald-700">
                    {inv.amountPaid > 0 ? `${inv.currency} ${inv.amountPaid.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
                    {inv.status === 'open' && balanceOf(inv) > 0 ? `${inv.currency} ${balanceOf(inv).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${inv.status === 'open' && inv.amountPaid > 0 ? 'bg-amber-100 text-amber-700' : STATUS_COLORS[inv.status]}`}>
                      {inv.status === 'open' && inv.amountPaid > 0 ? 'Part-paid' : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {inv.status === 'open' && balanceOf(inv) > 0 && (
                      <button
                        onClick={() => { setPaying(inv); setPart(false); setAmount(''); }}
                        className="mr-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        {inv.amountPaid > 0 ? 'Pay balance' : 'Pay'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(inv.id, inv.number)}
                      disabled={downloading === inv.id}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
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
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Showing {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
