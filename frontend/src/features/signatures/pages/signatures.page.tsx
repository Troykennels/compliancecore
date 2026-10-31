import { PermissionAction } from '@/components/permission-action';
import { humanize } from '@/lib/labels';
import { ModalSurface } from '@/components/modal-surface';
import { PageHeader } from '@/components/page-header';
import { useState } from 'react';
import { ShieldCheck, ShieldX, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { signaturesApi } from '../api/signatures.api';
import { SignDocumentDialog } from '../components/sign-document-dialog';
import { useSignatures, useRevokeSignature } from '../hooks/use-signatures';

export function SignaturesPage() {
  const fmt = useOrgFormat();
  const role = useAuthStore(state => state.activeTenant?.role);
  const canManage = !!role && ['owner','admin','compliance_manager','msp_admin'].includes(role);
  const canSign = canManage || role === 'control_owner';
  const [showSign,setShowSign] = useState(false);
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
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6"><PageHeader eyebrow="Review" title="Signatures"
        description={<>Sign a reviewed document and keep a record of the signer, time and document snapshot.{' '}<Link to="/guide#signatures" className="font-medium text-brand-700 underline">How to add and verify a signature</Link></>}
        actions={canSign ? <PermissionAction scope="signatures:create"><button onClick={()=>setShowSign(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Sign a document</button></PermissionAction> : undefined} /></div>
      {showSign && <SignDocumentDialog onClose={()=>setShowSign(false)} />}

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
          {canSign && <PermissionAction scope="signatures:create"><button onClick={()=>setShowSign(true)} className="mt-3 text-sm font-medium text-indigo-700 underline">Sign your first document</button></PermissionAction>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Document</th>
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
                  <td className="px-4 py-3 text-xs capitalize text-slate-700">{humanize(sig.documentType)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-xs">{sig.certificateData?.signerName ?? sig.signerName ?? '—'}</p>
                    <p className="text-slate-400 text-[11px]">{sig.certificateData?.signerEmail}</p>
                    {sig.signatureImage?.startsWith('data:image/png;base64,') && <img src={sig.signatureImage} alt="Drawn signature mark" className="mt-2 max-h-12 max-w-32 rounded border border-slate-100 bg-white object-contain" />}
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
                    <VerifyButton id={sig.id} />
                    {sig.isValid && canManage && (
                      <PermissionAction scope="signatures:manage"><button
                        onClick={() => setRevokeTarget(sig.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Revoke signature"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button></PermissionAction>
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
        <ModalSurface label="Revoke Signature" onClose={() => { setRevokeTarget(null); setRevokeReason(''); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-96">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Revoke Signature</h3>
            <p className="text-xs text-slate-500 mb-3">Provide a reason for revocation. This action will be permanently logged.</p>
            <textarea
              value={revokeReason}
              maxLength={500}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              placeholder="e.g. Signed in error, document version superseded"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none mb-3"
             aria-label="e.g. Signed in error, document version superseded" />
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
                  try { await revoke.mutateAsync({ id: revokeTarget, reason: revokeReason.trim() }); } catch { return; }
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
        </ModalSurface>
      )}
    </div>
  );
}

function VerifyButton({ id }: { id: string }) {
  const [message,setMessage]=useState(''),[pending,setPending]=useState(false);
  return <div className="mb-1 min-w-28"><button disabled={pending} className="text-xs font-medium text-indigo-700 underline disabled:opacity-50" onClick={async()=>{setPending(true);setMessage('');try{const result=(await signaturesApi.verify(id)).data.data;setMessage(result.valid?'Verified — authentic snapshot':result.reason||'Could not verify this signature');}catch{setMessage('Verification unavailable. Try again.');}finally{setPending(false);}}}>{pending?'Verifying…':'Verify'}</button>{message&&<p role="status" className="mt-1 max-w-48 text-xs text-slate-600">{message}</p>}</div>;
}
