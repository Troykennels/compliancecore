import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'At least one uppercase letter')
      .regex(/[a-z]/, 'At least one lowercase letter')
      .regex(/[0-9]/, 'At least one number')
      .regex(/[^A-Za-z0-9]/, 'At least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      authApi.resetPassword({ token: token!, password: data.password }).then((r) => r.data),
    onSuccess: () => setSuccess(true),
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      const message =
        err.response?.data?.error?.message ?? 'This reset link is invalid or has expired.';
      // Show error inline
      console.error(message);
    },
  });

  // Guard: token must be exactly 64 hex chars
  if (!token || token.length !== 64) {
    return <Navigate to={PATHS.FORGOT_PASSWORD} replace />;
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

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">Password reset</h1>
              <p className="text-sm text-slate-600">
                Your password has been reset. All active sessions have been signed out for security.
              </p>
              <Link
                to={PATHS.LOGIN}
                className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Sign in with new password
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-xl font-semibold text-slate-900">Set new password</h1>
              <p className="mb-6 text-sm text-slate-500">
                Your new password must be different from your previous password.
              </p>

              {mutation.error && (
                <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  {(mutation.error as { response?: { data?: { error?: { message: string } } } }).response?.data?.error?.message ??
                    'This reset link is invalid or has expired.'}
                </div>
              )}

              <form
                onSubmit={handleSubmit((v) => mutation.mutate(v))}
                noValidate
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoFocus
                      {...register('password')}
                      className={cn(
                        'block w-full rounded-md border px-3 py-2 pr-10 text-sm text-slate-900',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors',
                        errors.password ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white',
                      )}
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
                  {errors.password && (
                    <p className="text-xs text-rose-600" role="alert">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    className={cn(
                      'block w-full rounded-md border px-3 py-2 text-sm text-slate-900',
                      'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors',
                      errors.confirmPassword ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white',
                    )}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-rose-600" role="alert">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Reset password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
