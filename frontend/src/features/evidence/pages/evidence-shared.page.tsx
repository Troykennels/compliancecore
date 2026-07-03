import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Lock, Download, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { evidenceApi } from '../api/evidence.api';
import type { Evidence, EvidenceVersion } from '../types/evidence.types';

interface SharedPayload {
  evidence: Evidence;
  currentVersion: EvidenceVersion | null;
}

export function EvidenceSharedPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  // Derive tenant from URL search param ?tenant=...
  const searchParams = new URLSearchParams(window.location.search);
  const tenantId = searchParams.get('tenant') ?? '';

  const attempt = async (pwd?: string) => {
    setLoading(true);
    setError(null);
    try {
      // We use the raw token; the access endpoint accepts a `password` in the body
      const res = await evidenceApi.accessSharedEvidence(token!, tenantId, pwd);
      setPayload({
        evidence: res.data.data!.evidence,
        currentVersion: res.data.data!.currentVersion,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status: number; data?: { error?: { message?: string } } } })?.response?.status;
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      if (status === 401) {
        setNeedsPassword(true);
        if (attempted) setError('Incorrect password. Please try again.');
      } else if (status === 403) {
        setError(msg ?? 'This share link has expired.');
      } else if (status === 404) {
        setError('Share link not found or has been revoked.');
      } else {
        setError(msg ?? 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
      setAttempted(true);
    }
  };

  // Auto-attempt on first load (no password)
  React.useEffect(() => {
    if (!attempted && token) attempt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDownload = async () => {
    if (!payload?.currentVersion) return;
    try {
      // Request the download URL with the share token for authentication
      // In production, the public endpoint returns a presigned URL
      window.location.href = payload.currentVersion.fileKey; // simplified — real impl would call API
    } catch {
      // noop
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-semibold text-slate-800">ComplianceCore</span>
          <span className="text-slate-400">·</span>
          <span className="text-sm text-slate-500">Shared Evidence</span>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-8">
        <div className="w-full max-w-xl">
          {/* Loading state */}
          {loading && !payload && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-slate-500 text-sm">Loading shared evidence...</p>
            </div>
          )}

          {/* Error state */}
          {error && !needsPassword && (
            <div className="rounded-xl bg-white border border-slate-200 p-8 text-center shadow-sm">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {/* Password gate */}
          {needsPassword && !payload && (
            <div className="rounded-xl bg-white border border-slate-200 p-8 shadow-sm">
              <div className="flex flex-col items-center gap-3 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <Lock className="h-7 w-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Password Protected</h2>
                <p className="text-sm text-slate-500 text-center">
                  This share link is password protected. Enter the password to access the evidence.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') attempt(password); }}
                  autoFocus
                  className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  type="button"
                  onClick={() => attempt(password)}
                  disabled={!password || loading}
                  className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Access Evidence'}
                </button>
              </div>
            </div>
          )}

          {/* Success — show evidence details */}
          {payload && (
            <div className="space-y-4">
              <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-800">{payload.evidence.title}</h2>
                    {payload.evidence.description && (
                      <p className="mt-1 text-sm text-slate-600">{payload.evidence.description}</p>
                    )}
                    {payload.evidence.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {payload.evidence.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {payload.currentVersion && (
                <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">File</h3>
                    <span className="text-xs text-slate-400">Version {payload.currentVersion.versionNumber}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{payload.currentVersion.fileName}</p>
                      <p className="text-xs text-slate-500">
                        {payload.currentVersion.mimeType}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-slate-400">
                Shared via ComplianceCore · Access is logged for audit purposes
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
