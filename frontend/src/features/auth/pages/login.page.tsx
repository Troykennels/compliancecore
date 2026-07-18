import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { useLogin } from '../hooks/use-login';
import { LoginForm } from '../components/login-form';
import { MfaChallenge } from '../components/mfa-challenge';

export function LoginPage(): JSX.Element {
  const { login, isLoading } = useLogin();
  const [mfaState, setMfaState] = useState<{
    token: string;
    email: string;
  } | null>(null);

  const [pendingEmail, setPendingEmail] = useState('');

  const handleLoginSubmit = async (values: { email: string; password: string }) => {
    setPendingEmail(values.email);
    return login(values);
  };

  const handleLoginSuccess = (result: { requiresMfa: boolean; mfaChallengeToken?: string }) => {
    if (result.requiresMfa && result.mfaChallengeToken) {
      setMfaState({ token: result.mfaChallengeToken, email: pendingEmail });
    }
  };

  return (
    <AuthShell
      heading={mfaState ? 'Two-factor verification' : 'Sign in to your account'}
      subheading={
        mfaState ? undefined : (
          <>
            Don&apos;t have an account?{' '}
            <Link to={PATHS.REGISTER} className="text-indigo-600 hover:underline font-medium">
              Start your free trial
            </Link>
          </>
        )
      }
    >
      {mfaState ? (
        <MfaChallenge mfaChallengeToken={mfaState.token} email={mfaState.email} />
      ) : (
        <LoginForm
          isLoading={isLoading}
          onSubmit={handleLoginSubmit}
          onSuccess={handleLoginSuccess}
        />
      )}
    </AuthShell>
  );
}

function AuthShell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-xl font-bold text-slate-900">ComplianceCore</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">by ORION SOFT LIMITED</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">{heading}</h1>
          {subheading && (
            <p className="mb-6 text-sm text-slate-500">{subheading}</p>
          )}
          {children}
        </div>

        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ORION SOFT LIMITED
        </p>
      </div>
    </div>
  );
}
