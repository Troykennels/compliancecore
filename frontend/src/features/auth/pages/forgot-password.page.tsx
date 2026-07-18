import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage(): JSX.Element {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => authApi.forgotPassword(data).then((r) => r.data),
    onSuccess: (_, variables) => {
      setSubmittedEmail(variables.email);
      setSubmitted(true);
    },
    onError: () => {
      toast.error('Something went wrong sending the reset link. Please try again.');
    },
  });

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
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <Mail className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-slate-900">Check your inbox</h1>
              <p className="text-sm text-slate-600">
                If an account exists for{' '}
                <span className="font-medium text-slate-900">{submittedEmail}</span>, we&apos;ve
                sent a password reset link. It expires in 1 hour.
              </p>
              <p className="text-xs text-slate-400">
                Didn&apos;t receive it? Check your spam folder, or{' '}
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-indigo-600 hover:underline"
                >
                  try again
                </button>
                .
              </p>
              <Link
                to={PATHS.LOGIN}
                className="block text-sm text-indigo-600 hover:underline"
              >
                Return to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link
                to={PATHS.LOGIN}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
              <h1 className="mb-1 text-xl font-semibold text-slate-900">Forgot your password?</h1>
              <p className="mb-6 text-sm text-slate-500">
                Enter your work email and we&apos;ll send a reset link if an account exists.
              </p>

              <form
                onSubmit={handleSubmit((v) => mutation.mutate(v))}
                noValidate
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    {...register('email')}
                    className={cn(
                      'block w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors',
                      errors.email ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white',
                    )}
                    placeholder="you@company.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-xs text-rose-600" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
