import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';
import { organizationApi } from '../api/organization.api';
import { ScopingQuestionnaire } from '../components/scoping-questionnaire';
import { authApi } from '@/features/auth/api/auth.api';

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001+'] as const;

const schema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  industry: z.string().max(100).optional(),
  // The select starts on its "" placeholder and the field is genuinely
  // optional, but a bare `z.enum(...).optional()` rejects "" — so anyone who
  // did not open the dropdown got a silently dead "Create organization"
  // button: no error, no toast, no navigation, because handleSubmit never
  // reached onSubmit. That blocked the first action of every new customer.
  // "" is now accepted and normalised away before it is sent.
  size: z
    .union([z.enum(ORG_SIZES), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

type FormValues = z.infer<typeof schema>;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'organization' | 'scoping'>('organization');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Already onboarded — nothing to do here. Skipped once we are mid-flow, because
  // creating the organisation marks onboarding complete and would otherwise
  // redirect the user away from step 2 the moment step 1 succeeded.
  if (user?.onboardingCompletedAt && step === 'organization') {
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // 1. Create the organization (provisions the tenant schema server-side).
      //    Slow by nature — it builds every per-tenant table — so a dropped
      //    response does not mean the organisation was not created. The API
      //    treats a repeat call as idempotent and returns the existing org.
      try {
        await organizationApi.create(values);
      } catch (err) {
        const code = (err as { response?: { data?: { error?: { code?: string } } } })
          ?.response?.data?.error?.code;
        // An older API still answers a retry with 409. The organisation exists,
        // so carry on and pick it up in the session refresh below rather than
        // stranding the user on this screen.
        if (code !== 'ALREADY_ONBOARDED') throw err;
      }

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
          isSuperadmin: u.isSuperadmin,
          mfaEnabled: u.mfaEnabled,
        },
        accessToken,
        u.tenants[0] ?? null,
        u.tenants,
      );

      // Straight into scoping rather than the dashboard: an empty dashboard tells
      // a new customer nothing, whereas the questionnaire turns the first minute
      // into "here is what applies to you, adopt it".
      setStep('scoping');
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message: string } } } })?.response?.data?.error
          ?.message ?? 'Could not create your organization. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'scoping') {
    return (
      <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Step 2 of 2</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Let&apos;s work out what applies to you
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.firstName ? `${user.firstName}, this` : 'This'} takes about a minute and decides
            which frameworks we set up for you.
          </p>
          <div className="mt-6">
            <ScopingQuestionnaire
              variant="onboarding"
              onDone={() => navigate(PATHS.DASHBOARD, { replace: true })}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Step 1 of 2</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Set up your organization</h1>
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
            {submitting ? 'Setting up your workspace…' : 'Create organization'}
          </button>

          {/* Setup builds every table this organisation will use, so it is not
              instant. Saying so keeps a slow response from reading as a hang. */}
          {submitting && (
            <p className="text-center text-xs text-slate-500">
              This can take up to a minute — please don&apos;t close this page.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
