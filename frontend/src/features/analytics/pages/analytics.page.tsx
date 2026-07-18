import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, RefreshCw, ShieldCheck, Flame, ScrollText, Store, GraduationCap, ClipboardCheck } from 'lucide-react';
import { useAnalyticsOverview } from '../hooks/use-analytics';

const label = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const toData = (obj: Record<string, number>) => Object.entries(obj).map(([k, v]) => ({ name: label(k), value: v }));

const CONTROL_COLORS = ['#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#94A3B8'];
const SEVERITY_COLORS: Record<string, string> = { High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E', Critical: '#DC2626' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function Kpi({ icon, label: l, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</div>
      <div>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{l}</p>
      </div>
    </div>
  );
}

function BarBlock({ data, colorFn }: { data: { name: string; value: number }[]; colorFn?: (n: string) => string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={26}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={44} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#F8FAFC' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={colorFn ? colorFn(d.name) : '#6366F1'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAnalyticsOverview();

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading analytics…</div>;
  }
  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-sm">Failed to load analytics.</p>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const controlData = toData(data.controlsByStatus);
  const hasControls = controlData.some((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-slate-500">Cross-module insights across your compliance program</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<ShieldCheck className="h-4 w-4" />} label="Controls" value={data.totals.controls} />
        <Kpi icon={<Flame className="h-4 w-4" />} label="Risks" value={data.totals.risks} />
        <Kpi icon={<ScrollText className="h-4 w-4" />} label="Policies" value={data.totals.policies} />
        <Kpi icon={<Store className="h-4 w-4" />} label="Vendors" value={data.totals.vendors} />
        <Kpi icon={<ClipboardCheck className="h-4 w-4" />} label="Audits" value={data.totals.audits} />
        <Kpi icon={<GraduationCap className="h-4 w-4" />} label="Training" value={data.totals.trainingPrograms} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Controls by Status">
          {hasControls ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={controlData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {controlData.map((_, i) => <Cell key={i} fill={CONTROL_COLORS[i % CONTROL_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No controls yet</div>}
        </Card>

        <Card title="Risks by Severity (residual)">
          <BarBlock data={toData(data.risksBySeverity)} colorFn={(n) => SEVERITY_COLORS[n] ?? '#6366F1'} />
        </Card>

        <Card title="Policies by Status"><BarBlock data={toData(data.policiesByStatus)} /></Card>
        <Card title="Vendors by Risk Level"><BarBlock data={toData(data.vendorsByRisk)} colorFn={(n) => SEVERITY_COLORS[n] ?? '#6366F1'} /></Card>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card title="Open Audit Findings">
          <p className="text-3xl font-semibold text-slate-900">{data.openAuditFindings}</p>
          <p className="text-xs text-slate-500">findings awaiting remediation</p>
        </Card>
        <Card title="Training Completion">
          <div className="flex gap-6">
            <div><p className="text-2xl font-semibold text-green-600">{data.trainingCompletion.completed}</p><p className="text-xs text-slate-500">Completed</p></div>
            <div><p className="text-2xl font-semibold text-amber-500">{data.trainingCompletion.assigned}</p><p className="text-xs text-slate-500">Assigned</p></div>
            <div><p className="text-2xl font-semibold text-red-500">{data.trainingCompletion.overdue}</p><p className="text-xs text-slate-500">Overdue</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
