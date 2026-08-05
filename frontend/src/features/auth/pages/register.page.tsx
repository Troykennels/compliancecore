import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';
import { cn } from '@/lib/utils';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one number')
    .regex(/[^A-Za-z0-9]/, 'At least one special character'),
});

type FormValues = z.infer<typeof schema>;

const passwordRules = [
  { test: (v: string) => v.length >= 8, label: 'At least 8 characters' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'One uppercase letter' },
  { test: (v: string) => /[a-z]/.test(v), label: 'One lowercase letter' },
  { test: (v: string) => /[0-9]/.test(v), label: 'One number' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'One special character' },
];

export function RegisterPage(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function handleResend() {
    setResending(true);
    setResendMessage('');
    try {
      await authApi.resendVerification(registeredEmail);
      setResendMessage(`Sent again to ${registeredEmail}. It usually arrives within a minute.`);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message: string } } } })
        .response?.data?.error?.message;
      // Shows the rate-limit text rather than a generic failure, so someone who
      // has already asked several times is told to wait instead of retrying.
      setResendMessage(message ?? 'Could not send just now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const passwordValue = watch('password', '');

  const mutation = useMutation({
    mutationFn: (data: FormValues) => authApi.register(data).then((r) => r.data),
    onSuccess: (_, variables) => {
      setRegisteredEmail(variables.email);
      setSuccess(true);
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      const message =
        err.response?.data?.error?.message ?? 'Registration failed. Please try again.';
      toast.error(message);
    },
  });

  if (success) {
    return (
      <AuthShell heading="Check your email">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <p className="text-sm text-slate-600">
            We sent a verification link to{' '}
            <span className="font-medium text-slate-900">{registeredEmail}</span>.
            Click the link to activate your account.
          </p>
          <p className="text-xs text-slate-400">The link expires in 24 hours.</p>

          {/* The resend belongs HERE, on the screen you are actually looking at
              when the email does not arrive. It was previously only on the
              verification page, which you can only reach by clicking a link —
              so the one person who needed it could never get to it. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
            <p className="text-xs text-slate-600">
              Nothing after a minute or two? Check your spam folder, then send it again.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-2 text-sm font-semibold text-brand-600 hover:underline disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            {resendMessage && <p className="mt-1.5 text-xs text-slate-500">{resendMessage}</p>}
          </div>

          <Link to={PATHS.LOGIN} className="block text-sm text-brand-600 hover:underline">
            Return to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Create your account"
      subheading={
        <>
          Already have an account?{' '}
          <Link to={PATHS.LOGIN} className="text-indigo-600 hover:underline font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              autoFocus
              {...register('firstName')}
              className={inputClass(!!errors.firstName)}
            />
            {errors.firstName && <FieldError>{errors.firstName.message}</FieldError>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              {...register('lastName')}
              className={inputClass(!!errors.lastName)}
            />
            {errors.lastName && <FieldError>{errors.lastName.message}</FieldError>}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={inputClass(!!errors.email)}
            placeholder="you@company.com"
          />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
              className={inputClass(!!errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password strength checklist */}
          {passwordValue && (
            <ul className="mt-2 space-y-1">
              {passwordRules.map((rule) => {
                const passed = rule.test(passwordValue);
                return (
                  <li key={rule.label} className={cn('flex items-center gap-1.5 text-xs', passed ? 'text-emerald-600' : 'text-slate-400')}>
                    <CheckCircle2 className={cn('h-3.5 w-3.5', passed ? 'text-emerald-500' : 'text-slate-300')} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>

        <p className="text-center text-xs text-slate-400">
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'block w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors',
    hasError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white',
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-rose-600" role="alert">
      {children}
    </p>
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-xl font-bold text-slate-900">ComplianceCore</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">{heading}</h1>
          {subheading && <p className="mb-6 text-sm text-slate-500">{subheading}</p>}
          {children}
        </div>
        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ORION SOFT LIMITED
        </p>
      </div>
    </div>
  );
}
