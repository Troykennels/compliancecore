import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  AlertTriangle, CalendarClock, Sparkles, TrendingUp, ShieldAlert,
  ScrollText, Users, Grid3x3, ClipboardCheck, Trophy,
} from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import type {
  HeatCell, OwnerRank, RiskPoint, ProductivityRow, Recommendation, FindingRow, PolicyRow,
} from '../hooks/use-dashboard-insights';

/* Shared shell so every new card matches the ones already on the page:
   rounded-2xl, hairline slate border, white ground, 20px padding. */
export function Panel({
  title, icon, action, onAction, children, className = '',
}: {
  title: string;
  icon: React.ReactNode;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white px-5 py-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h2>
        {action && onAction && (
          <button onClick={onAction} className="shrink-0 text-xs text-blue-600 hover:text-blue-800">
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="py-6 text-center text-xs text-slate-400">{children}</p>;
}

/* Implementation percentage to fill. Slate at zero rather than white, so an
   untouched cell still reads as part of the grid instead of a hole in it. */
function heatFill(pct: number | null, total: number): string {
  if (!total) return 'bg-slate-50 text-slate-300';
  if (pct === null) return 'bg-slate-100 text-slate-400';
  if (pct >= 90) return 'bg-emerald-600 text-white';
  if (pct >= 70) return 'bg-emerald-400 text-white';
  if (pct >= 50) return 'bg-amber-400 text-white';
  if (pct >= 25) return 'bg-orange-400 text-white';
  return 'bg-rose-500 text-white';
}

const CRITS = ['critical', 'high', 'medium', 'low'] as const;

export function ComplianceHeatmap({ categories, cells }: { categories: string[]; cells: HeatCell[] }): JSX.Element {
  const at = (category: string, criticality: string) =>
    cells.find((c) => c.category === category && c.criticality === criticality);

  return (
    <Panel title="Compliance Heatmap" icon={<Grid3x3 className="h-4 w-4" />}>
      {!categories.length ? (
        <Empty>Adopt a framework to populate the heatmap.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-40" />
                {CRITS.map((c) => (
                  <th key={c} className="pb-1 text-center font-medium capitalize text-slate-500">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category}>
                  <td className="max-w-40 truncate pr-2 text-slate-600" title={category}>{category}</td>
                  {CRITS.map((crit) => {
                    const cell = at(category, crit);
                    const total = cell?.total ?? 0;
                    return (
                      <td key={crit} className="p-0">
                        <div
                          className={`flex h-9 items-center justify-center rounded font-semibold ${heatFill(cell?.pct ?? null, total)}`}
                          title={total ? `${category} · ${crit}: ${cell?.pct ?? 0}% of ${total}` : 'No controls'}
                        >
                          {total ? `${cell?.pct ?? 0}%` : '–'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">
            Implementation by control category and criticality. Red is where an auditor looks first.
          </p>
        </div>
      )}
    </Panel>
  );
}

export interface Deadline { id: string; label: string; date: string; kind: string; overdue: boolean }

export function UpcomingDeadlines({ items }: { items: Deadline[] }): JSX.Element {
  const fmt = useOrgFormat();
  const navigate = useNavigate();
  return (
    <Panel
      title="Upcoming Deadlines" icon={<CalendarClock className="h-4 w-4" />}
      action="Calendar" onAction={() => navigate('/calendar')}
    >
      {!items.length ? (
        <Empty>Nothing due in the next 30 days.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 6).map((d) => (
            <li key={d.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${d.overdue ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900">{d.label}</p>
                <p className="text-[10px] text-slate-500">{d.kind}</p>
              </div>
              <span className={`shrink-0 text-[11px] ${d.overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                {fmt.formatDateShort(d.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OwnerRanking({ rows }: { rows: OwnerRank[] }): JSX.Element {
  return (
    <Panel title="Compliance by Owner" icon={<Trophy className="h-4 w-4" />}>
      {!rows.length ? (
        <Empty>Assign owners to controls to see a ranking.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.owner} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-slate-800">{r.owner}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{r.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${r.pct >= 70 ? 'bg-emerald-500' : r.pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.max(r.pct, 2)}%` }}
                  />
                </div>
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                {r.total} ctrl
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        Ranked by control owner. Controls are not linked to departments in the data model.
      </p>
    </Panel>
  );
}

export function RiskTrend({ data }: { data: RiskPoint[] }): JSX.Element {
  const hasData = data.some((d) => d.opened || d.closed);
  return (
    <Panel title="Risk Trend" icon={<ShieldAlert className="h-4 w-4" />}>
      {!hasData ? (
        <Empty>No risks recorded in the last six months.</Empty>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="opened" name="Opened" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="closed" name="Treated" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function FrameworkProgress({
  frameworks,
}: { frameworks: { frameworkName: string | null; score: number | null; controlCounts: { total: number; implemented: number } }[] }): JSX.Element {
  const navigate = useNavigate();
  return (
    <Panel
      title="Framework Completion" icon={<TrendingUp className="h-4 w-4" />}
      action="Frameworks" onAction={() => navigate('/frameworks')}
    >
      {!frameworks.length ? (
        <Empty>Adopt a framework to track completion.</Empty>
      ) : (
        <ul className="space-y-3">
          {frameworks.slice(0, 6).map((f) => {
            const pct = Math.round(f.score ?? 0);
            return (
              <li key={f.frameworkName ?? 'unmapped'}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-slate-800">{f.frameworkName ?? 'Unmapped'}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {f.controlCounts.implemented}/{f.controlCounts.total}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-900">{pct}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function TeamProductivity({ rows }: { rows: ProductivityRow[] }): JSX.Element {
  return (
    <Panel title="Team Productivity" icon={<Users className="h-4 w-4" />}>
      {!rows.length ? (
        <Empty>No tasks assigned yet.</Empty>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category" dataKey="name" width={90}
                tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" name="Open" stackId="a" fill="#cbd5e1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

const REC_STYLE: Record<Recommendation['severity'], string> = {
  high:   'border-rose-200 bg-rose-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-slate-200 bg-slate-50',
};

export function AiRecommendations({ items }: { items: Recommendation[] }): JSX.Element {
  return (
    <Panel title="Recommendations" icon={<Sparkles className="h-4 w-4" />}>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className={`rounded-lg border px-3 py-2.5 ${REC_STYLE[r.severity]}`}>
            <p className="text-xs leading-relaxed text-slate-800">{r.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">
        Derived from your current data, refreshed on every load.
      </p>
    </Panel>
  );
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-600',
};

export function RecentFindings({ findings }: { findings: FindingRow[] }): JSX.Element {
  const navigate = useNavigate();
  return (
    <Panel
      title="Recent Audit Findings" icon={<ClipboardCheck className="h-4 w-4" />}
      action="Audits" onAction={() => navigate('/audits')}
    >
      {!findings.length ? (
        <Empty>No findings recorded.</Empty>
      ) : (
        <ul className="space-y-2">
          {findings.slice(0, 6).map((f) => (
            <li key={f.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${SEVERITY_BADGE[f.severity] ?? SEVERITY_BADGE.low}`}>
                {f.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900">{f.title}</p>
                {f.auditTitle && <p className="truncate text-[10px] text-slate-500">{f.auditTitle}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ExpiringPolicies({ policies }: { policies: PolicyRow[] }): JSX.Element {
  const fmt = useOrgFormat();
  const navigate = useNavigate();
  const now = Date.now();
  const due = policies
    .filter((p) => p.reviewDueDate)
    .sort((a, b) => new Date(a.reviewDueDate!).getTime() - new Date(b.reviewDueDate!).getTime())
    .slice(0, 6);

  return (
    <Panel
      title="Policies Due for Review" icon={<ScrollText className="h-4 w-4" />}
      action="Policies" onAction={() => navigate('/policies')}
    >
      {!due.length ? (
        <Empty>No policies have a review date set.</Empty>
      ) : (
        <ul className="space-y-2">
          {due.map((p) => {
            const overdue = new Date(p.reviewDueDate!).getTime() < now;
            return (
              <li key={p.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
                {overdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900">{p.title}</p>
                  <p className="text-[10px] capitalize text-slate-500">{p.status.replace(/_/g, ' ')}</p>
                </div>
                <span className={`shrink-0 text-[11px] ${overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                  {fmt.formatDateShort(p.reviewDueDate)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function ComplianceTrendPanel({ data }: { data: { date: string; score: number | null }[] }): JSX.Element {
  return (
    <Panel title="Compliance Trend" icon={<TrendingUp className="h-4 w-4" />}>
      {data.length < 2 ? (
        <Empty>The trend appears once a few daily snapshots exist.</Empty>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="ccScoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} fill="url(#ccScoreFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
