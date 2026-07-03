import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';
import { cn } from '@/lib/utils';

interface MfaChallengeProps {
  mfaChallengeToken: string;
  email: string;
}

export function MfaChallenge({ mfaChallengeToken, email }: MfaChallengeProps): JSX.Element {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSuccess = (data: Awaited<ReturnType<typeof authApi.completeMfaChallenge>>['data']['data']) => {
    setAuth(data.user, data.accessToken, data.activeTenant, data.allTenants);
    navigate(data.user.onboardingCompletedAt ? PATHS.DASHBOARD : PATHS.ONBOARDING, { replace: true });
  };

  const totpMutation = useMutation({
    mutationFn: (code: string) =>
      authApi.completeMfaChallenge({ mfaChallengeToken, code }).then((r) => r.data.data),
    onSuccess: handleSuccess,
    onError: () => {
      toast.error('Invalid code. Please try again.');
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    },
  });

  const backupMutation = useMutation({
    mutationFn: () =>
      authApi.completeMfaWithBackupCode({ mfaChallengeToken, backupCode }).then((r) => r.data.data),
    onSuccess: handleSuccess,
    onError: () => toast.error('Invalid backup code.'),
  });

  const isLoading = totpMutation.isPending || backupMutation.isPending;

  const submitCode = (code: string) => {
    if (code.length === 6 && /^\d+$/.test(code)) {
      totpMutation.mutate(code);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...digits];
    updated[index] = value.slice(-1);
    setDigits(updated);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    const code = updated.join('');
    if (updated.every((d) => d) && code.length === 6) {
      submitCode(code);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      submitCode(pasted);
    }
  };

  if (useBackupCode) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          Enter one of your 10-character backup codes.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="backup-code" className="block text-sm font-medium text-slate-700">
            Backup code
          </label>
          <input
            id="backup-code"
            type="text"
            autoComplete="off"
            autoFocus
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            placeholder="XXXXXXXX"
          />
        </div>
        <button
          type="button"
          disabled={!backupCode || isLoading}
          onClick={() => backupMutation.mutate()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white',
            'hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          )}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify backup code
        </button>
        <button
          type="button"
          onClick={() => setUseBackupCode(false)}
          className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Use authenticator app instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-lg bg-indigo-50 p-4">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-indigo-600" />
        <p className="text-sm text-indigo-800">
          Enter the 6-digit code from your authenticator app for{' '}
          <span className="font-medium">{email}</span>
        </p>
      </div>

      {/* OTP digit inputs */}
      <div className="flex justify-center gap-2" role="group" aria-label="6-digit verification code">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            autoFocus={i === 0}
            disabled={isLoading}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              'h-12 w-10 rounded-md border text-center text-lg font-bold text-slate-900',
              'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
              'disabled:opacity-50 transition-colors',
              digit ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white',
            )}
          />
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setUseBackupCode(true)}
        className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
      >
        Lost access to your authenticator? Use a backup code
      </button>
    </div>
  );
}
