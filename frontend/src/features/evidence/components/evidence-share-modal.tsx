import { useState } from 'react';
import { X, Link2, Mail, Clock, Lock, Copy, Check, AlertCircle, Trash2 } from 'lucide-react';
import { useEvidenceShares, useCreateShare, useRevokeShare } from '../hooks/use-evidence';
import { useActiveTenant } from '@/stores/auth.store';
import type { CreateShareDto } from '../types/evidence.types';
import { useOrgFormat } from '@/lib/org-format';

interface EvidenceShareModalProps {
  open: boolean;
  onClose: () => void;
  evidenceId: string;
  evidenceTitle: string;
}

export function EvidenceShareModal({ open, onClose, evidenceId, evidenceTitle }: EvidenceShareModalProps) {
  const fmt = useOrgFormat();
  const { data: shares = [], isLoading } = useEvidenceShares(evidenceId);
  const createShare = useCreateShare(evidenceId);
  const revokeShare = useRevokeShare(evidenceId);
  const activeTenant = useActiveTenant();

  // Build a full, externally-openable share URL. Recipients are outside the app,
  // so the link must be absolute and carry the ?tenant=... param the shared page needs.
  const buildShareUrl = (token: string) =>
    `${window.location.origin}/evidence/shared/${token}${activeTenant ? `?tenant=${activeTenant.id}` : ''}`;

  const [form, setForm] = useState<CreateShareDto>({ shareType: 'link' });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    const result = await createShare.mutateAsync(form);
    setNewShareUrl(result.shareUrl);
    setForm({ shareType: 'link' });
  };

  const copy = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!open) return null;

  const activeShares = shares.filter((s) => !s.isRevoked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Share Evidence</h2>
            <p className="mt-0.5 text-xs text-slate-500 truncate max-w-xs">{evidenceTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* New share link creation */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-800">Create Share Link</h3>

            {/* Share type */}
            <div className="grid grid-cols-2 gap-2">
              {(['link', 'email'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, shareType: type }))}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    form.shareType === type
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {type === 'link' ? <Link2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  {type === 'link' ? 'Link Share' : 'Email Share'}
                </button>
              ))}
            </div>

            {/* Email recipient */}
            {form.shareType === 'email' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Recipient Email</label>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={form.recipientEmail ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Expiry */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                  <Clock className="h-3 w-3" /> Expiry Date (optional)
                </label>
                <input
                  type="date"
                  value={form.expiresAt ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value || null }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                  <Lock className="h-3 w-3" /> Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank for no password"
                  value={form.password ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value || null }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={createShare.isPending}
              className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createShare.isPending ? 'Creating...' : 'Generate Share Link'}
            </button>
          </div>

          {/* Newly created share URL */}
          {newShareUrl && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
              <p className="text-sm font-medium text-green-800">Share link created!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-800 border border-green-200">
                  {newShareUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(newShareUrl, 'new')}
                  className="shrink-0 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  {copiedToken === 'new' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-green-700 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                This URL is active immediately. Anyone with it can access this evidence.
              </p>
            </div>
          )}

          {/* Existing shares */}
          {activeShares.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-800">
                Active Links ({activeShares.length})
              </h3>
              <div className="space-y-2">
                {activeShares.map((share) => (
                  <div key={share.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {share.shareType === 'email'
                          ? <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          : <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        }
                        {share.recipientEmail && (
                          <span className="text-xs font-medium text-slate-700">{share.recipientEmail}</span>
                        )}
                        {share.hasPassword && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                            <Lock className="h-2.5 w-2.5" /> Password
                          </span>
                        )}
                        {share.expiresAt && (
                          <span className="flex items-center gap-0.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                            <Clock className="h-2.5 w-2.5" />
                            Expires {fmt.formatDateMedium(share.expiresAt)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {share.accessedCount} access{share.accessedCount !== 1 ? 'es' : ''} ·{' '}
                        Created {fmt.formatDateMedium(share.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copy(buildShareUrl(share.shareToken), share.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-200"
                        title="Copy link"
                      >
                        {copiedToken === share.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeShare.mutate(share.id)}
                        disabled={revokeShare.isPending}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                        title="Revoke link"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && shares.filter((s) => !s.isRevoked).length === 0 && !newShareUrl && (
            <p className="text-center text-sm text-slate-400 py-4">No active share links.</p>
          )}
        </div>
      </div>
    </div>
  );
}
