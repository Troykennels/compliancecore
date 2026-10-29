import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle, ChevronDown, Circle, ShieldCheck, AlertTriangle, ListChecks } from 'lucide-react';
import { useDashboard } from '../hooks/use-dashboard';
import { ComplianceWorkSummary } from '../components/compliance-work-summary';
import { ImplementationOverview } from '@/features/frameworks/components/implementation-overview';
import { ControlStatusChart } from '../components/control-status-chart';
import { ScoreTrendChart } from '../../compliance-score/components/score-trend-chart';
import { ExpiryWidget } from '../components/expiry-widget';
import { ActivityFeed } from '../components/activity-feed';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';
import { ROLE_GUIDANCE } from '@/config/role-guidance';
import { useOrgFormat } from '@/lib/org-format';
import { Card, CardHeader, ErrorState, PageShell, SkeletonRegion, SkeletonCard } from '@/components/ui';

export function DashboardPage() {
  const fmt = useOrgFormat();
  const role = useAuthStore(s => s.activeTenant?.role);
  const can = (scope: string) => hasPermission(role, scope);
  const [showDetails, setShowDetails] = useState(false);
  const { data, isLoading, isError, refetch } = useDashboard();
  if (isLoading) return <PageShell width="wide"><SkeletonRegion label="Loading compliance overview" className="space-y-5"><SkeletonCard rows={4} /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(n => <SkeletonCard key={n} rows={5} />)}</div></SkeletonRegion></PageShell>;
  if (isError || !data) return <PageShell width="wide"><Card><ErrorState title="Your overview could not be loaded" description="Please try again to see the latest recorded figures." onRetry={() => void refetch()} /></Card></PageShell>;
  const { complianceScore, controls, expiry, calendar, recentActivity } = data;
  const applicable = controls.total - controls.notApplicable;
  // One headline figure, the same rule as the status chart: operating controls out of all controls in scope.
  const progress = applicable > 0 ? Math.round(100 * controls.implemented / applicable) : null;
  const cards = [
    { title: 'Total controls', status: '', value: controls.total, help: 'All recorded safeguards', icon: ListChecks, style: 'border-blue-200 bg-blue-50 text-blue-800' },
    { title: 'Operating', status: 'implemented', value: controls.implemented, help: 'Recorded as in place', icon: CheckCircle, style: 'border-green-200 bg-green-50 text-green-800' },
    { title: 'Partly operating', status: 'partially_implemented', value: controls.partiallyImplemented, help: 'Further work is needed', icon: Circle, style: 'border-amber-200 bg-amber-50 text-amber-800' },
    { title: 'Not operating', status: 'not_implemented', value: controls.notImplemented, help: 'Recorded as not in place', icon: AlertTriangle, style: 'border-red-200 bg-red-50 text-red-800' },
    { title: 'Planned', status: 'planned', value: controls.planned, help: 'Agreed but not yet in place', icon: Circle, style: 'border-slate-200 bg-slate-50 text-slate-700' },
    { title: 'Not yet assessed', status: 'not_assessed', value: controls.notAssessed ?? 0, help: 'Waiting for an assessment', icon: Circle, style: 'border-slate-200 bg-slate-50 text-slate-700' },
    { title: 'Not applicable', status: 'not_applicable', value: controls.notApplicable, help: 'Recorded as outside scope', icon: ShieldCheck, style: 'border-violet-200 bg-violet-50 text-violet-800' },
  ];
  return <PageShell width="wide" className="!space-y-5 !py-5">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#073f40] via-[#086963] to-[#14857a] p-5 text-white shadow-sm sm:p-6" aria-labelledby="overview-title">
      <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border-[40px] border-white/5" aria-hidden="true" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <p className="text-xs font-medium text-white/80">Your organisation at a glance · {fmt.formatDateMedium(new Date())}</p>
          <h1 id="overview-title" className="mt-2 text-2xl font-semibold tracking-tight !text-white sm:text-3xl">Compliance overview</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/90">{role ? ROLE_GUIDANCE[role].purpose : 'See where things stand, what needs attention and what to do next.'}</p>
          {role && <span className="mt-3 inline-block rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide">{ROLE_GUIDANCE[role].label} view</span>}
          <div className="mt-4 flex flex-wrap gap-2">
            {can('controls:read') && <Link to="/frameworks" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#07534f] hover:bg-green-50">Review assessments <ArrowRight className="h-3.5 w-3.5" /></Link>}
            {can('reports:read') && <Link to="/reports" className="rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">Open management report</Link>}
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-white/20 bg-white/10 p-4 lg:max-w-[260px]">
          <p className="text-xs font-medium text-white/90">Controls operating</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{progress === null ? 'Not scored' : `${progress}%`}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/90">{controls.implemented} of {applicable} controls in scope are recorded as operating. The weighted compliance score is on the score page.</p>
          {can('reports:read') && <Link to="/compliance-score" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">View compliance score <ArrowRight className="h-3 w-3" /></Link>}
        </div>
      </div>
    </section>
    <section aria-label="Control status totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map(({ title, status, value, help, icon: Icon, style }) => {
        const content = <><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{title}</span><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /></div><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs opacity-90">{help}</p></>;
        const className = `min-w-0 rounded-xl border p-4 text-left ${style}`;
        return can('controls:read') ? <Link key={title} to={status ? `/controls?status=${status}` : '/controls'} aria-label={`${title}: ${value}. Open the controls list`} className={`${className} transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}>{content}</Link> : <div key={title} className={className}>{content}</div>;
      })}
    </section>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <ControlStatusChart controls={controls} />
      {can('controls:read') ? <ImplementationOverview compact /> : <Card><CardHeader title="Your next step" description="Use the pages available to your role to keep your records current." /><Link to="/guide" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpen className="h-4 w-4" /> Open your user guide</Link></Card>}
    </div>
    {can('reports:read') && <ComplianceWorkSummary />}
    <section className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setShowDetails(v => !v)} aria-expanded={showDetails} aria-controls="overview-detail" className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span><span className="block text-sm font-semibold text-slate-900">Dates, activity and score history</span><span className="mt-1 block text-xs text-slate-500">{calendar.overdueCount} overdue calendar events · {expiry.expired} expired tracked items</span></span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>
      {showDetails && <div id="overview-detail" className="space-y-5 border-t border-slate-200 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {can('expiry:read') && <Card><CardHeader title="Expiring items" action={<Link to="/expiry" className="text-xs font-semibold text-brand-700">View tracker</Link>} /><div className="mt-3"><ExpiryWidget items={expiry.urgentItems} expiringSoon={expiry.expiringSoon} expired={expiry.expired} /></div></Card>}
          {can('evidence:read') && <Card><CardHeader title="Recent evidence activity" action={<Link to="/evidence" className="text-xs font-semibold text-brand-700">View evidence</Link>} /><div className="mt-3"><ActivityFeed events={recentActivity} /></div></Card>}
        </div>
        {can('reports:read') && <Card><CardHeader title="Recorded score history" description="Historical snapshots of recorded control status." /><div className="mt-4"><ScoreTrendChart data={complianceScore.trend} height={180} /></div></Card>}
        {can('calendar:read') && <Link to="/calendar" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Open the review calendar <ArrowRight className="h-4 w-4" /></Link>}
      </div>}
    </section>
    <p className="text-xs leading-relaxed text-slate-500">Figures describe your recorded work. An internal score or completed assessment is not a certification.</p>
  </PageShell>;
}
