import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react';
import { authApi } from '@/features/auth/api/auth.api';
import type { MfaSetupResponse } from '@/features/auth/types/auth.types';

type Stage = 'idle' | 'scanning' | 'codes';

interface MfaSetupProps {
  enabled: boolean;
  onChanged: () => void;
}

/**
 * TOTP two-factor enrolment.
 *
 * Three stages, because the backup codes are only ever returned once — if they
 * are shown alongside the QR code the user scans and moves on without saving
 * them, and the only way back into a lost account becomes a support ticket. So
 * they get their own step, after the code has been verified.
 */
export function MfaSetup({ enabled, onChanged }: MfaSetupProps): JSX.Element {
  const [stage, setStage] = useState<Stage>('idle');
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');

  const startSetup = useMutation({
    mutationFn: () => authApi.setupMfa().then((r) => r.data.data),
    onSuccess: (data) => {
      setSetupData(data);
      setStage('scanning');
    },
    onError: (err: ApiError) =>
      toast.error(err.response?.data?.error?.message ?? 'Could not start two-factor setup.'),
  });

  const confirmSetup = useMutation({
    mutationFn: () => authApi.confirmMfaSetup(code).then((r) => r.data.data),
    onSuccess: () => {
      setStage('codes');
      setCode('');
      onChanged();
    },
    onError: (err: ApiError) =>
      toast.error(err.response?.data?.error?.message ?? 'That code was not accepted.'),
  });

  const disableMfa = useMutation({
    mutationFn: () => authApi.disableMfa(password),
    onSuccess: () => {
      toast.success('Two-factor authentication disabled.');
      setDisabling(false);
      setPassword('');
      onChanged();
    },
    onError: (err: ApiError) =>
      toast.error(err.response?.data?.error?.message ?? 'Could not disable two-factor authentication.'),
  });

  function copyBackupCodes() {
    if (!setupData) return;
    void navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Already enabled ────────────────────────────────────────────────────────
  if (enabled && stage !== 'codes') {
    return (
      <div className="space-y-3">
        {!disabling ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Enabled
            </span>
            <button
              type="button"
              onClick={() => setDisabling(true)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Disable
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); disableMfa.mutate(); }}
            className="max-w-sm space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
          >
            <p className="text-sm text-rose-800">
              Confirm your password to turn off two-factor authentication.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Current password"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={disableMfa.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {disableMfa.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Disable 2FA
              </button>
              <button
                type="button"
                onClick={() => { setDisabling(false); setPassword(''); }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ── Stage 3: backup codes (shown once) ─────────────────────────────────────
  if (stage === 'codes' && setupData) {
    return (
      <div className="max-w-md space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Save your backup codes</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Each code works once, and this is the only time they are shown. Store them
              somewhere safe — without them, losing your authenticator means losing access.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-1.5 rounded-md border border-amber-200 bg-white p-3 font-mono text-sm">
          {setupData.backupCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyBackupCodes}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy codes'}
          </button>
          <button
            type="button"
            onClick={() => { setStage('idle'); setSetupData(null); toast.success('Two-factor authentication is on.'); }}
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            I have saved them
          </button>
        </div>
      </div>
    );
  }

  // ── Stage 2: scan and verify ───────────────────────────────────────────────
  if (stage === 'scanning' && setupData) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); confirmSetup.mutate(); }}
        className="max-w-md space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <p className="text-sm text-slate-700">
          Scan this with Google Authenticator, 1Password, Authy or any TOTP app, then enter
          the six-digit code it shows.
        </p>

        <img
          src={setupData.qrCodeDataUri}
          alt="Two-factor authentication QR code"
          className="h-44 w-44 rounded-md border border-slate-200 bg-white p-2"
        />

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Can&apos;t scan? Enter this key manually</summary>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-slate-700">
            {setupData.secret}
          </code>
        </details>

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="block w-40 rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={code.length !== 6 || confirmSetup.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {confirmSetup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify and enable
          </button>
          <button
            type="button"
            onClick={() => { setStage('idle'); setSetupData(null); setCode(''); }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // ── Stage 1: not enabled ───────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={() => startSetup.mutate()}
      disabled={startSetup.isPending}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {startSetup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      Enable 2FA
    </button>
  );
}

interface ApiError {
  response?: { data?: { error?: { message: string } } };
}
