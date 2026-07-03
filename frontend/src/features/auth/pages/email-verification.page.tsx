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
  const called = useRef(false); // prevent double invocation in React 18 StrictMode

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
              <XCircle className="mx-auto h-12 w-12 text-rose-500" />
              <h1 className="text-xl font-semibold text-slate-900">Verification failed</h1>
              <p className="text-sm text-slate-600">{errorMessage}</p>
              <div className="space-y-3">
                <Link
                  to={PATHS.LOGIN}
                  className="block text-sm text-indigo-600 hover:underline"
                >
                  Return to sign in
                </Link>
                <p className="text-xs text-slate-400">
                  Need a new link?{' '}
                  <Link to={PATHS.LOGIN} className="text-indigo-600 hover:underline">
                    Sign in to request another
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
