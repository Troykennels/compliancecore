import { useState } from 'react';
import { ShieldCheck, ShieldX, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import { useSignatures, useRevokeSignature } from '../hooks/use-signatures';

export function SignaturesPage() {
  const fmt = useOrgFormat();
  const [validFilter, setValidFilter] = useState<'all' | 'valid' | 'revoked'>('all');
  const [page, setPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const filters = {
    ...(validFilter === 'valid'   && { isValid: true }),
    ...(validFilter === 'revoked' && { isValid: false }),
    page,
    limit: 20,
  };

  const { data, isLoading, isError, refetch } = useSignatures(filters);
  const revoke = useRevokeSignature();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Digital Signatures</h1>
        <p className="text-sm text-slate-500 mt-0.5">HMAC-SHA256 tamper-evident audit trail of all signed documents</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['all', 'valid', 'revoked'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setValidFilter(v); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                validFilter === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-400">{total} signatures</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-rose-300 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Couldn't load signatures.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No signatures found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Signed By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Signed At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Document Hash</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Signature Hash</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((sig) => (
                <tr key={sig.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {sig.isValid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                        <ShieldCheck className="h-3 w-3" /> Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                        <ShieldX className="h-3 w-3" /> Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-xs">{sig.certificateData?.signerName ?? sig.signerName ?? '—'}</p>
                    <p className="text-slate-400 text-[11px]">{sig.certificateData?.signerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {fmt.formatDateTime(sig.signedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-slate-500">{sig.documentHash ? `${sig.documentHash.slice(0, 16)}…` : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-slate-500">{sig.signatureHash ? `${sig.signatureHash.slice(0, 16)}…` : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {sig.isValid && (
                      <button
                        onClick={() => setRevokeTarget(sig.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Revoke signature"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!sig.isValid && sig.revocationReason && (
                      <span className="text-[10px] text-red-400 italic max-w-[100px] truncate block" title={sig.revocationReason}>
                        {sig.revocationReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-slate-100">Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-slate-100">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revoke modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-96">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Revoke Signature</h3>
            <p className="text-xs text-slate-500 mb-3">Provide a reason for revocation. This action will be permanently logged.</p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              placeholder="e.g. Signed in error, document version superseded"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRevokeTarget(null); setRevokeReason(''); }}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!revokeReason.trim()) return;
                  await revoke.mutateAsync({ id: revokeTarget, reason: revokeReason.trim() });
                  setRevokeTarget(null);
                  setRevokeReason('');
                }}
                disabled={!revokeReason.trim() || revoke.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
