import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, Calendar, Bell,
  CheckCircle, BarChart2, RefreshCw,
} from 'lucide-react';
import { useDashboard } from '../hooks/use-dashboard';
import { ScoreGauge } from '../../compliance-score/components/score-gauge';
import { ScoreTrendChart } from '../../compliance-score/components/score-trend-chart';
import { MetricCard } from '../components/metric-card';
import { ExpiryWidget } from '../components/expiry-widget';
import { ActivityFeed } from '../components/activity-feed';
import { FrameworkCoverage } from '../components/framework-coverage';
import { useCurrentScore } from '../../compliance-score/hooks/use-score';
import { EVENT_TYPE_COLORS } from '../../calendar/types/calendar.types';
import type { CalendarEventType } from '../../calendar/types/calendar.types';

const STATUS_BADGE: Record<string, string> = {
  upcoming:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: scoreData } = useCurrentScore();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        Loading dashboard…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-sm">Failed to load your dashboard.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { complianceScore, controls, expiry, calendar, notifications, recentActivity } = data;
  const frameworks = scoreData?.frameworks ?? [];

  const controlImplementedPct = controls.total > 0
    ? Math.round((controls.implemented / controls.total) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      {/* Page title */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Compliance overview — {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 gap-4 shrink-0 xl:grid-cols-4">
        <MetricCard
          title="Compliance Score"
          value={complianceScore.overall !== null ? `${Math.round(complianceScore.overall)}%` : 'N/A'}
          subtitle={complianceScore.snapshotDate ? `as of ${format(parseISO(complianceScore.snapshotDate), 'MMM d')}` : 'Real-time'}
          icon={<ShieldCheck className="h-5 w-5" />}
          colorClass="bg-blue-100 text-blue-600"
          onClick={() => navigate('/compliance-score')}
        />
        <MetricCard
          title="Controls Implemented"
          value={`${controls.implemented}/${controls.total}`}
          subtitle={`${controlImplementedPct}% complete`}
          icon={<CheckCircle className="h-5 w-5" />}
          colorClass="bg-green-100 text-green-600"
        />
        <MetricCard
          title="Expiry Alerts"
          value={expiry.expiringSoon + expiry.expired}
          subtitle={`${expiry.expired} expired · ${expiry.expiringSoon} expiring`}
          icon={<AlertTriangle className="h-5 w-5" />}
          colorClass={expiry.expired > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}
          onClick={() => navigate('/expiry')}
        />
        <MetricCard
          title="Unread Notifications"
          value={notifications.unread}
          subtitle={`${calendar.overdueCount} overdue events`}
          icon={<Bell className="h-5 w-5" />}
          colorClass={notifications.unread > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}
          onClick={() => navigate('/notifications')}
        />
      </div>

      {/* Middle row: score gauge + trend + upcoming calendar */}
      <div className="grid grid-cols-1 gap-5 shrink-0 lg:grid-cols-3">
        {/* Score gauge */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-6">
          <ScoreGauge score={complianceScore.overall} size={180} />
          <p className="mt-2 text-xs text-slate-500">Overall Compliance</p>
        </div>

        {/* Score trend */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Score Trend (180 days)</h2>
            <button
              onClick={() => navigate('/compliance-score')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Full view
            </button>
          </div>
          <ScoreTrendChart data={complianceScore.trend} height={160} />
        </div>
      </div>

      {/* Bottom row: framework coverage + calendar + expiry + activity */}
      <div className="grid grid-cols-1 gap-5 shrink-0 lg:grid-cols-3">
        {/* Framework coverage */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Framework Coverage</h2>
            <BarChart2 className="h-4 w-4 text-slate-400" />
          </div>
          <FrameworkCoverage frameworks={frameworks} />
        </div>

        {/* Upcoming calendar events */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Events</h2>
            <button onClick={() => navigate('/calendar')} className="text-xs text-blue-600 hover:text-blue-800">View all</button>
          </div>
          {calendar.upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Calendar className="h-7 w-7 mb-2 opacity-30" />
              <p className="text-xs">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {calendar.upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate('/calendar')}
                >
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color || EVENT_TYPE_COLORS[ev.eventType as CalendarEventType] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{ev.title}</p>
                    <p className="text-[10px] text-slate-500">{format(parseISO(ev.startDate), 'MMM d')}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[ev.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ev.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {calendar.overdueCount > 0 && (
                <p className="text-xs text-red-600 font-medium pt-1">
                  {calendar.overdueCount} overdue event{calendar.overdueCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Control Status</h2>
          <div className="space-y-2.5">
            {[
              { label: 'Implemented',         value: controls.implemented,         color: 'bg-green-500' },
              { label: 'Partially Implemented',value: controls.partiallyImplemented, color: 'bg-amber-400' },
              { label: 'Not Implemented',      value: controls.notImplemented,       color: 'bg-red-500' },
              { label: 'Planned',              value: controls.planned,              color: 'bg-blue-400' },
              { label: 'Not Applicable',       value: controls.notApplicable,        color: 'bg-slate-300' },
            ].map(({ label, value, color }) => {
              const pct = controls.total > 0 ? (value / controls.total) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium text-slate-900">{value}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: expiry urgent + recent activity */}
      <div className="grid grid-cols-1 gap-5 shrink-0 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Urgent Expirations</h2>
            <button onClick={() => navigate('/expiry')} className="text-xs text-blue-600 hover:text-blue-800">View all</button>
          </div>
          <ExpiryWidget
            items={expiry.urgentItems}
            expiringSoon={expiry.expiringSoon}
            expired={expiry.expired}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent Evidence Activity</h2>
            <button onClick={() => navigate('/evidence')} className="text-xs text-blue-600 hover:text-blue-800">View all</button>
          </div>
          <ActivityFeed events={recentActivity} />
        </div>
      </div>
    </div>
  );
}
