import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

interface LoginFormProps {
  onSuccess: (data: { requiresMfa: boolean; mfaChallengeToken?: string }) => void;
  isLoading: boolean;
  onSubmit: (values: FormValues) => Promise<{ requiresMfa: boolean; mfaChallengeToken?: string }>;
}

export function LoginForm({ onSuccess, isLoading, onSubmit }: LoginFormProps): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submit = async (values: FormValues) => {
    const result = await onSubmit(values);
    onSuccess(result);
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      {/* Email */}
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
            'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
            'transition-colors duration-100',
            errors.email
              ? 'border-rose-500 bg-rose-50 focus:ring-rose-500'
              : 'border-slate-300 bg-white',
          )}
          placeholder="you@company.com"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-rose-600" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <Link
            to={PATHS.FORGOT_PASSWORD}
            className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
            className={cn(
              'block w-full rounded-md border px-3 py-2 pr-10 text-sm text-slate-900',
              'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
              'transition-colors duration-100',
              errors.password
                ? 'border-rose-500 bg-rose-50 focus:ring-rose-500'
                : 'border-slate-300 bg-white',
            )}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
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
          <p id="password-error" className="text-xs text-rose-600" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
          'bg-indigo-600 text-sm font-semibold text-white',
          'hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors duration-100',
        )}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
