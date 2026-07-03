import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';
import { organizationApi } from '../api/organization.api';
import { authApi } from '@/features/auth/api/auth.api';

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001+'] as const;

const schema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  industry: z.string().max(100).optional(),
  size: z.enum(ORG_SIZES).optional(),
});

type FormValues = z.infer<typeof schema>;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Already onboarded — nothing to do here.
  if (user?.onboardingCompletedAt) {
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // 1. Create the organization (provisions the tenant schema server-side).
      await organizationApi.create(values);

      // 2. Refresh the session so the new access token carries the tenant id
      //    and the updated onboarding state, then hydrate the store.
      const refreshRes = await authApi.refresh();
      const accessToken = refreshRes.data.data.accessToken;
      const meRes = await authApi.me();
      const u = meRes.data.data;
      setAuth(
        {
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          avatarUrl: u.avatarUrl,
          emailVerifiedAt: u.emailVerifiedAt,
          isActive: u.isActive,
          onboardingCompletedAt: u.onboardingCompletedAt,
        },
        accessToken,
        u.tenants[0] ?? null,
        u.tenants,
      );

      navigate(PATHS.DASHBOARD, { replace: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message: string } } } })?.response?.data?.error
          ?.message ?? 'Could not create your organization. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Set up your organization</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}. Create your organization to get
          started with ComplianceCore.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Organization name *
            </label>
            <input
              {...register('name')}
              autoFocus
              placeholder="Acme Corporation"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Industry</label>
            <input
              {...register('industry')}
              placeholder="e.g. Financial Services"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Company size</label>
            <select
              {...register('size')}
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="" disabled>
                Select size…
              </option>
              {ORG_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} employees
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
