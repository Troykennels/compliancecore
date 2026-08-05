import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';
import { SUPPORT_EMAIL } from '@/config/contact';

/**
 * Deleting an organisation.
 *
 * The API supports this properly — request, 30-day grace, then permanent
 * erasure — but nothing in the product could reach it, so the screen told
 * owners to email support instead. That is not a safeguard, it is a missing
 * feature with a note attached, and it left the product unable to honour a
 * GDPR/NDPA erasure request without someone running SQL.
 *
 * The organisation's name must be typed to confirm, which is the standard guard
 * for something irreversible. Nothing here is instant: access stops now, the
 * data goes after the grace window, and it can be restored until then.
 */
export function DeleteOrganization({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const matches = confirmName.trim().toLowerCase() === organizationName.trim().toLowerCase();

  async function handleDelete() {
    setSubmitting(true);
    try {
      const res = await apiClient.delete('/organizations', { data: { confirmName } });
      const purgeAfter = res.data?.data?.purgeAfter;
      const when = purgeAfter
        ? new Date(purgeAfter).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

      toast.success(
        when
          ? `Organisation scheduled for deletion. Data is erased on ${when}.`
          : 'Organisation scheduled for deletion.',
      );

      // Access is already revoked server-side, so staying signed in would just
      // produce a screen of failing requests.
      clearAuth();
      window.location.href = PATHS.LOGIN;
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message: string } } } })
        .response?.data?.error?.message;
      toast.error(message ?? 'Could not delete the organisation. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Delete organisation</p>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">
            Everyone loses access immediately and billing stops. Your data is kept
            for <strong>30 days</strong> so you can export it or change your mind, then it is
            permanently erased. After that it cannot be recovered by us or by you.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            Delete organisation
          </button>
        )}
      </div>

      {open && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900">
                This deletes every record in {organizationName}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">
                Controls, policies, risks, evidence, audits and their history. If you
                need a copy, export your data first from the section above.
              </p>

              <label htmlFor="confirm-org" className="mt-3 block text-xs font-medium text-red-900">
                Type <strong>{organizationName}</strong> to confirm
              </label>
              <input
                id="confirm-org"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full max-w-sm rounded-lg border border-red-300 px-3 py-2 text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!matches || submitting}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Scheduling…' : 'Delete this organisation'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setConfirmName(''); }}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>

              <p className="mt-3 text-xs text-red-800">
                Changed your mind? Contact <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
                within 30 days and we can restore it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
