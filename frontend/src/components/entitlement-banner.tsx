import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';

export interface Entitlement {
  state: 'trialing' | 'active' | 'expiring' | 'grace' | 'read_only' | 'suspended' | 'cancelled';
  canWrite: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  /** From the server's clock; the browser only displays it. */
  hoursRemaining?: number | null;
  planName: string | null;
  planSlug: string | null;
}

/**
 * Shows the organisation's subscription state across the top of the app.
 *
 * Purely informational — the API enforces the same states independently, so a
 * user who hides this banner gains nothing. Its job is to make sure nobody is
 * surprised: a trial quietly lapsing into read-only, with writes failing and no
 * explanation, is far worse than a countdown they saw coming.
 *
 * Deliberately silent while a subscription is healthy; a permanent banner on a
 * paid account is just noise.
 */
export function EntitlementBanner(): JSX.Element | null {
  // The platform owner is not a customer. Showing them "your subscription has
  // expired — choose a plan" on their own product is both wrong and alarming,
  // and the API now exempts them from enforcement too, so the banner would be
  // warning about a restriction that does not apply.
  const isSuperadmin = useAuthStore((s) => s.user?.isSuperadmin);

  const { data: ent } = useQuery<Entitlement | null>({
    queryKey: ['billing', 'entitlement'],
    queryFn: async () => (await apiClient.get('/billing/entitlement')).data.data,
    // Long enough not to add a request to every navigation, short enough that a
    // customer who has just paid sees the banner clear without a reload.
    staleTime: 60_000,
    retry: false,
  });

  if (isSuperadmin) return null;
  if (!ent || ent.state === 'active') return null;

  const days = ent.daysRemaining ?? 0;
  const hours = ent.hoursRemaining ?? null;
  // Days, or hours on the last day: the countdown the prompt asks for.
  const countdown = hours !== null && hours < 24
    ? (hours <= 0 ? 'today' : `in ${hours} hour${hours === 1 ? '' : 's'}`)
    : (days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`);
  const dueDate = ent.expiresAt ? new Date(ent.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  if (ent.state === 'expiring') {
    return (
      <Bar tone="amber" icon={<Clock className="h-4 w-4 shrink-0" />}>
        <span>
          Your {ent.planName ?? 'subscription'} renews or ends {countdown}{dueDate ? ` (${dueDate})` : ''}.
          Renew or upgrade to keep full access.
        </span>
      </Bar>
    );
  }

  if (ent.state === 'suspended') {
    return (
      <Bar tone="red" icon={<Lock className="h-4 w-4 shrink-0" />}>
        <span>
          This organisation's subscription is <strong>suspended</strong>. Your records stay available to view and
          export, but changes are paused. Contact Orion Soft Limited to restore it.
        </span>
      </Bar>
    );
  }

  if (ent.state === 'cancelled') {
    return (
      <Bar tone="red" icon={<Lock className="h-4 w-4 shrink-0" />}>
        <span>
          Your subscription was cancelled, so this organisation is <strong>read-only</strong>. Your data is safe and
          still exportable. Choose a plan to start making changes again.
        </span>
      </Bar>
    );
  }

  if (ent.state === 'trialing') {
    // Stay quiet early in the trial and speak up as it runs out.
    if (days > 5) return null;
    return (
      <Bar tone="amber" icon={<Clock className="h-4 w-4 shrink-0" />}>
        <span>
          {days <= 0
            ? 'Your free trial ends today.'
            : `${days} day${days === 1 ? '' : 's'} left in your free trial.`}{' '}
          Choose a plan to keep full access.
        </span>
      </Bar>
    );
  }

  if (ent.state === 'grace') {
    return (
      <Bar tone="amber" icon={<AlertTriangle className="h-4 w-4 shrink-0" />}>
        <span>
          Your {ent.planName ?? 'subscription'} has expired. You still have full access for a
          short grace period — please choose a plan to avoid interruption.
        </span>
      </Bar>
    );
  }

  return (
    <Bar tone="red" icon={<Lock className="h-4 w-4 shrink-0" />}>
      <span>
        Your subscription has expired, so this organisation is <strong>read-only</strong>. Your
        data is safe and still exportable — choose a plan to start making changes again.
      </span>
    </Bar>
  );
}

function Bar({
  tone,
  icon,
  children,
}: {
  tone: 'amber' | 'red';
  icon: JSX.Element;
  children: React.ReactNode;
}): JSX.Element {
  const styles =
    tone === 'red'
      ? 'bg-red-50 text-red-800 border-red-200'
      : 'bg-amber-50 text-amber-900 border-amber-200';
  return (
    <div className={`flex items-center gap-2 border-b px-4 py-2 text-sm ${styles}`}>
      {icon}
      <div className="flex-1">{children}</div>
      <Link
        to={PATHS.BILLING_PLANS}
        className="shrink-0 rounded-lg bg-white/70 px-3 py-1 text-xs font-semibold hover:bg-white"
      >
        View plans
      </Link>
    </div>
  );
}
