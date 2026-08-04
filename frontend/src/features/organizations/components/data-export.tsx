import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { organizationApi } from '../api/organization.api';
import { useUserRole } from '@/stores/auth.store';

/**
 * "Download everything" — the organisation's full record set as a ZIP.
 *
 * Restricted to owner and admin. The API enforces this independently; hiding the
 * button is only so other roles are not offered something they will be refused.
 */
export function DataExport(): JSX.Element | null {
  const role = useUserRole();
  const [busy, setBusy] = useState(false);

  const canExport = role === 'owner' || role === 'admin';
  if (!canExport) return null;

  async function handleExport() {
    setBusy(true);
    try {
      const res = await organizationApi.exportAll();

      // The server names the file; fall back to a dated name if the header is
      // stripped by a proxy.
      const disposition = res.headers['content-disposition'] as string | undefined;
      const named = disposition?.match(/filename="([^"]+)"/)?.[1];
      const filename = named ?? `compliancecore-export-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Release the blob once the browser has taken it, or the whole archive
      // stays in memory for the life of the tab.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success('Your data has been downloaded.');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 429
          ? 'Export limit reached. You can download your data again in an hour.'
          : 'Could not build your export. Please try again, or contact support if it keeps failing.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-slate-900">Download all your data</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Everything your organisation holds — controls, policies, risks, incidents, vendors,
          audits, training, tasks, approvals, signatures, evidence records and your team — as
          a ZIP containing both JSON and Excel-ready CSV.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Evidence <em>files</em> are not included; their details and checksums are. Passwords,
          MFA secrets and API keys are deliberately excluded.
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Owner and admin only. Large organisations may take a minute.
        </p>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? 'Preparing…' : 'Download everything'}
      </button>
    </div>
  );
}
