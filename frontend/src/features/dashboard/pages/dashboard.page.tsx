import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, Calendar, Bell,
  CheckCircle, BarChart2, ArrowRight,
} from 'lucide-react';
import { useDashboard } from '../hooks/use-dashboard';
import { ScoreGauge } from '../../compliance-score/components/score-gauge';
import { ScoreTrendChart } from '../../compliance-score/components/score-trend-chart';
import { MetricCard } from '../components/metric-card';
import { ExpiryWidget } from '../components/expiry-widget';
import { ActivityFeed } from '../components/activity-feed';
import { FrameworkCoverage } from '../components/framework-coverage';
import { DashboardInsights } from '../components/dashboard-insights';
import { useCurrentScore } from '../../compliance-score/hooks/use-score';
import { EVENT_TYPE_COLORS } from '../../calendar/types/calendar.types';
import type { CalendarEventType } from '../../calendar/types/calendar.types';
import { useOrgFormat } from '@/lib/org-format';
import { cn } from '@/lib/utils';
import {
  Card, CardHeader, ErrorState, PageHeader, PageShell, StatusPill,
  SkeletonCard, SkeletonChart, SkeletonMetricCard, SkeletonRegion, Skeleton,
  type StatusTone,
} from '@/components/ui';

const EVENT_STATUS_TONE: Record<string, StatusTone> = {
  upcoming: 'info',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'danger',
};

/** Control status, ordered worst-first so the gaps read before the wins. */
const CONTROL_BANDS = [
  { key: 'notImplemented', label: 'Not implemented', bar: 'bg-red-500' },
  { key: 'partiallyImplemented', label: 'Partially implemented', bar: 'bg-amber-500' },
  { key: 'planned', label: 'Planned', bar: 'bg-brand-400' },
  { key: 'implemented', label: 'Implemented', bar: 'bg-green-500' },
  { key: 'notApplicable', label: 'Not applicable', bar: 'bg-slate-300' },
] as const;

function ViewAll({ onClick, label = 'View all' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 rounded text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
    >
      {label}
      <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * Loading view.
 *
 * Mirrors the real layout rather than showing a spinner, so the page does not
 * reflow when the data lands — the cards are already where they will be.
 */
function DashboardSkeleton() {
  return (
    <PageShell width="wide">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <SkeletonRegion label="Loading dashboard" className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonMetricCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SkeletonChart height={200} />
          <SkeletonChart height={200} className="lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} rows={4} />)}
        </div>
      </SkeletonRegion>
    </PageShell>
  );
}

export function DashboardPage() {
  const fmt = useOrgFormat();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: scoreData } = useCurrentScore();

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <PageShell width="wide">
        <Card flush>
          <ErrorState
            title="We couldn't load your dashboard"
            description="Your compliance data is safe — this is a problem reaching the service, not a problem with your records."
            onRetry={() => refetch()}
          />
        </Card>
      </PageShell>
    );
  }

  const { complianceScore, controls, expiry, calendar, notifications, recentActivity } = data;
  const frameworks = scoreData?.frameworks ?? [];

  const controlImplementedPct = controls.total > 0
    ? Math.round((controls.implemented / controls.total) * 100)
    : 0;

  const expiryTotal = expiry.expiringSoon + expiry.expired;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Dashboard"
        description={`Compliance overview — ${fmt.formatDateMedium(new Date())}`}
      />

      {/* Headline metrics. Single column on a phone: two 3xl figures side by
          side at 375px truncate into meaninglessness. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Compliance Score"
          value={complianceScore.overall !== null ? `${Math.round(complianceScore.overall)}%` : '—'}
          subtitle={complianceScore.snapshotDate ? `as of ${fmt.formatDateShort(complianceScore.snapshotDate)}` : 'Real-time'}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="brand"
          onClick={() => navigate('/compliance-score')}
        />
        <MetricCard
          title="Controls Implemented"
          value={`${controls.implemented}/${controls.total}`}
          subtitle={`${controlImplementedPct}% complete`}
          icon={<CheckCircle className="h-5 w-5" />}
          tone={controlImplementedPct >= 80 ? 'success' : controlImplementedPct >= 50 ? 'warning' : 'danger'}
          onClick={() => navigate('/controls')}
        />
        <MetricCard
          title="Expiry Alerts"
          value={expiryTotal}
          subtitle={`${expiry.expired} expired · ${expiry.expiringSoon} expiring`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={expiry.expired > 0 ? 'danger' : expiry.expiringSoon > 0 ? 'warning' : 'success'}
          onClick={() => navigate('/expiry')}
        />
        <MetricCard
          title="Unread Notifications"
          value={notifications.unread}
          subtitle={`${calendar.overdueCount} overdue events`}
          icon={<Bell className="h-5 w-5" />}
          tone={notifications.unread > 0 ? 'warning' : 'neutral'}
          onClick={() => navigate('/notifications')}
        />
      </div>

      {/* Score gauge + trend */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center py-7">
          <ScoreGauge score={complianceScore.overall} size={180} />
          <p className="eyebrow mt-3">Overall Compliance</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Score Trend"
            description="Last 180 days"
            action={<ViewAll onClick={() => navigate('/compliance-score')} label="Full view" />}
          />
          <div className="mt-4">
            <ScoreTrendChart data={complianceScore.trend} height={172} />
          </div>
        </Card>
      </div>

      {/* Coverage, upcoming work, control posture */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Framework Coverage"
            action={<BarChart2 className="h-4 w-4 text-slate-400" aria-hidden="true" />}
          />
          <div className="mt-4">
            <FrameworkCoverage frameworks={frameworks} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming Events"
            action={<ViewAll onClick={() => navigate('/calendar')} />}
          />
          <div className="mt-4">
            {calendar.upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
                <p className="text-xs font-medium text-slate-600">Nothing scheduled</p>
                <p className="mt-0.5 text-2xs text-slate-400">
                  Reviews and audits you plan will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {calendar.upcomingEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => navigate('/calendar')}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span
                      className="h-6 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color || EVENT_TYPE_COLORS[ev.eventType as CalendarEventType] }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-900">{ev.title}</span>
                      <span className="block text-2xs text-slate-500">{fmt.formatDateShort(ev.startDate)}</span>
                    </span>
                    <StatusPill tone={EVENT_STATUS_TONE[ev.status] ?? 'neutral'} dot={false}>
                      {ev.status.replace('_', ' ')}
                    </StatusPill>
                  </button>
                ))}
                {calendar.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/calendar')}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {calendar.overdueCount} overdue event{calendar.overdueCount > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Control Status" description={`${controls.total} controls in scope`} />
          <div className="mt-4 space-y-3">
            {CONTROL_BANDS.map(({ key, label, bar }) => {
              const value = controls[key] ?? 0;
              const pct = controls.total > 0 ? (value / controls.total) * 100 : 0;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{label}</span>
                    <span data-numeric className="shrink-0 font-semibold text-slate-900">
                      {value}
                      <span className="ml-1 font-normal text-slate-400">{Math.round(pct)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500 ease-out', bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Expiring items + evidence activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Urgent Expirations"
            action={<ViewAll onClick={() => navigate('/expiry')} />}
          />
          <div className="mt-4">
            <ExpiryWidget
              items={expiry.urgentItems}
              expiringSoon={expiry.expiringSoon}
              expired={expiry.expired}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Evidence Activity"
            action={<ViewAll onClick={() => navigate('/evidence')} />}
          />
          <div className="mt-4">
            <ActivityFeed events={recentActivity} />
          </div>
        </Card>
      </div>

      {/* Insight panels. Rendered after the existing summary so the page still
          reads top-down: headline numbers, then where the gaps are. Each panel
          owns its own query, so a slow or failing module degrades that card
          rather than the whole dashboard. */}
      <DashboardInsights
        trend={complianceScore.trend}
        upcomingEvents={calendar.upcomingEvents}
        urgentExpiry={expiry.urgentItems}
        expiringSoon={expiry.expiringSoon}
        score={complianceScore.overall}
        frameworks={frameworks}
      />
    </PageShell>
  );
}
