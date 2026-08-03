import { useState } from 'react';
import { ArrowLeft, Download, Search, Loader2, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useInvoices } from '../hooks/use-billing';
import { billingApi } from '../api/billing.api';
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

  const { data: invoices = [], isLoading, isError, refetch } = useInvoices({
    status: statusFilter || undefined,
    limit: 100,
  });

  const filtered = invoices.filter((inv) =>
    !search ||
    inv.number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.tenantName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

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
      <div className="flex items-center gap-3">
        <Link to={PATHS.BILLING} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">Download and manage your billing history</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
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
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
