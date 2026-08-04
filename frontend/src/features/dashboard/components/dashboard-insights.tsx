import { useMemo } from 'react';
import {
  useControlsForInsights, useRisksForInsights, useTasksForInsights,
  usePoliciesForInsights, useRecentFindings,
  buildHeatmap, rankByOwner, riskTrend, teamProductivity, buildRecommendations,
} from '../hooks/use-dashboard-insights';
import {
  ComplianceHeatmap, UpcomingDeadlines, OwnerRanking, RiskTrend, FrameworkProgress,
  TeamProductivity, AiRecommendations, RecentFindings, ExpiringPolicies,
  ComplianceTrendPanel, type Deadline,
} from './insight-widgets';

interface Props {
  trend: { date: string; score: number | null }[];
  upcomingEvents: { id: string; title: string; startDate: string; eventType: string; status: string }[];
  urgentExpiry: { id: string; name: string; expiryDate: string; status: string }[];
  expiringSoon: number;
  score: number | null;
  frameworks: {
    frameworkName: string | null;
    score: number | null;
    controlCounts: { total: number; implemented: number };
  }[];
}

/**
 * The analytical half of the dashboard.
 *
 * Everything is computed in the browser from endpoints that already exist — no
 * new API routes and no change to any existing one. Queries run independently so
 * one unavailable module leaves an empty card rather than an empty page.
 */
export function DashboardInsights({
  trend, upcomingEvents, urgentExpiry, expiringSoon, score, frameworks,
}: Props): JSX.Element {
  const controlsQ = useControlsForInsights();
  const risksQ    = useRisksForInsights();
  const tasksQ    = useTasksForInsights();
  const policiesQ = usePoliciesForInsights();
  const findingsQ = useRecentFindings();

  const controls = useMemo(() => controlsQ.data ?? [], [controlsQ.data]);
  const risks    = useMemo(() => risksQ.data ?? [], [risksQ.data]);
  const tasks    = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const policies = useMemo(() => policiesQ.data ?? [], [policiesQ.data]);

  const heatmap      = useMemo(() => buildHeatmap(controls), [controls]);
  const owners       = useMemo(() => rankByOwner(controls), [controls]);
  const riskPoints   = useMemo(() => riskTrend(risks), [risks]);
  const productivity = useMemo(() => teamProductivity(tasks), [tasks]);

  const recommendations = useMemo(
    () => buildRecommendations({
      controls, risks, tasks, policies, overdueExpiry: expiringSoon, score,
    }),
    [controls, risks, tasks, policies, expiringSoon, score],
  );

  // Calendar events, expiring items and overdue policy reviews share one list:
  // to the person reading it they are all simply "things with a date".
  const deadlines = useMemo<Deadline[]>(() => {
    const now = Date.now();
    const rows: Deadline[] = [
      ...upcomingEvents.map((e) => ({
        id: `event-${e.id}`,
        label: e.title,
        date: e.startDate,
        kind: e.eventType.replace(/_/g, ' '),
        overdue: new Date(e.startDate).getTime() < now,
      })),
      ...urgentExpiry.map((x) => ({
        id: `expiry-${x.id}`,
        label: x.name,
        date: x.expiryDate,
        kind: 'Expiring',
        overdue: new Date(x.expiryDate).getTime() < now,
      })),
      ...policies
        .filter((p) => p.reviewDueDate)
        .map((p) => ({
          id: `policy-${p.id}`,
          label: `${p.title} — review due`,
          date: p.reviewDueDate as string,
          kind: 'Policy review',
          overdue: new Date(p.reviewDueDate as string).getTime() < now,
        })),
    ];
    // Overdue first, then soonest.
    return rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [upcomingEvents, urgentExpiry, policies]);

  return (
    <div className="shrink-0 space-y-5">
      {/* Full-width: the heatmap needs the horizontal room to stay readable. */}
      <ComplianceHeatmap categories={heatmap.categories} cells={heatmap.cells} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <AiRecommendations items={recommendations} />
        <UpcomingDeadlines items={deadlines} />
        <FrameworkProgress frameworks={frameworks} />
        <ComplianceTrendPanel data={trend} />
        <RiskTrend data={riskPoints} />
        <OwnerRanking rows={owners} />
        <TeamProductivity rows={productivity} />
        <RecentFindings findings={findingsQ.data ?? []} />
        <ExpiringPolicies policies={policies} />
      </div>
    </div>
  );
}
