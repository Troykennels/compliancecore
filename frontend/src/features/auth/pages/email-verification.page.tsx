import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';

type State = 'verifying' | 'success' | 'error';

export function EmailVerificationPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const called = useRef(false); // prevent double invocation in React 18 StrictMode

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResending(true);
    setResendMessage('');
    try {
      const res = await authApi.resendVerification(resendEmail);
      setResendMessage(res.data.data?.message ?? 'If that address needs verifying, a new link is on its way.');
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message: string } } } })
        .response?.data?.error?.message;
      // Surfaces the rate-limit message rather than a generic failure, so
      // someone who has just requested three links is told to wait rather than
      // left retrying.
      setResendMessage(message ?? 'Could not send right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;

    authApi
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((err: { response?: { data?: { error?: { message: string } } } }) => {
        const message =
          err.response?.data?.error?.message ?? 'Verification failed. The link may have expired.';
        setErrorMessage(message);
        setState('error');
      });
  }, [token]);

  if (!token || token.length !== 64) {
    return <Navigate to={PATHS.LOGIN} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-xl font-bold text-slate-900">ComplianceCore</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
          {state === 'verifying' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-600" />
              <h1 className="text-xl font-semibold text-slate-900">Verifying your email…</h1>
              <p className="text-sm text-slate-500">Please wait a moment.</p>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-semibold text-slate-900">Email verified!</h1>
              <p className="text-sm text-slate-600">
                Your account is now active. You can sign in and start building your compliance programme.
              </p>
              <Link
                to={PATHS.LOGIN}
                className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Sign in to ComplianceCore
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="text-xl font-semibold text-slate-900">Verification failed</h1>
              <p className="text-sm text-slate-600">{errorMessage}</p>

              {/* A real resend, not a link back to sign-in. The previous copy
                  said "sign in to request another", which is a dead end: you
                  cannot sign in until you have verified, so anyone whose link
                  expired or never arrived had nowhere to go. */}
              <form onSubmit={handleResend} className="space-y-2 pt-2 text-left">
                <label htmlFor="resend-email" className="block text-xs font-medium text-slate-700">
                  Send a new verification link
                </label>
                <div className="flex gap-2">
                  <input
                    id="resend-email"
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={resending}
                    className="h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                  >
                    {resending ? 'Sending…' : 'Resend'}
                  </button>
                </div>
                {resendMessage && <p className="text-xs text-slate-500">{resendMessage}</p>}
              </form>

              <Link to={PATHS.LOGIN} className="block pt-2 text-sm text-brand-600 hover:underline">
                Return to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
