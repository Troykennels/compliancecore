import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart2, FileDown, FileSpreadsheet, Calendar, Clock,
  RefreshCw, TrendingUp, ShieldCheck, CheckSquare, X, Plus, Trash2, ToggleLeft, ToggleRight, Mail,
} from 'lucide-react';
import {
  useExecutiveDashboard, useDownloadPdf, useDownloadExcel,
  useScheduledReports, useCreateScheduledReport, useUpdateScheduledReport, useDeleteScheduledReport,
} from '../hooks/use-reports';
import type {
  ReportFilter, ControlsByCriticality, FrameworkCoverage,
  ScheduledReport, CreateScheduledReportDto,
} from '../types/reports.types';
import { useOrgFormat } from '@/lib/org-format';
import { CHART } from '@/lib/chart-theme';
import { Button, ErrorState, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

// ── Palette ────────────────────────────────────────────────────────────────────
// Drawn from the shared chart theme so a "72%" here is the same amber as a
// "72%" on the dashboard. These were previously a private hex set, which is why
// the two screens never quite agreed.

const CHART_COLORS = {
  implemented:   CHART.success,
  partial:       CHART.warning,
  notImpl:       CHART.danger,
  planned:       CHART.brandSoft,
  notApplicable: CHART.axis,
  todo:          CHART.axis,
  in_progress:   CHART.brand,
  in_review:     CHART.brandSoft,
  completed:     CHART.success,
  cancelled:     '#4B5568',
  blocked:       CHART.warning,
  active:        CHART.success,
  archived:      '#4B5568',
  expired:       CHART.danger,
  blue:          CHART.brand,
};

const CRITICALITY_COLORS: Record<string, string> = {
  critical: CHART.danger,
  high:     '#EE9E2E',
  medium:   CHART.warning,
  low:      CHART.brandSoft,
};

// ── Shared UI primitives ───────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-surface overflow-hidden ${className}`}>{children}</div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-slate-100 px-5 py-3.5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <BarChart2 className="mb-1.5 h-6 w-6 text-slate-300" aria-hidden="true" />
      <p className="text-xs text-slate-500">Nothing to chart yet</p>
    </div>
  );
}

/** Placeholder shaped like a chart panel, so the layout does not jump. */
function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`card-surface p-5 ${className}`}>
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="mt-1.5 h-2.5 w-24" />
      <Skeleton className="mt-5 h-40 w-full rounded-lg" />
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colors = {
    blue:  'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-600',
  };
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-1">{label}</p>
        <p data-numeric className="text-2xl font-semibold leading-none tracking-tight text-slate-900">
          {value}
        </p>
        {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Date range picker ──────────────────────────────────────────────────────────

const PRESETS = [
  { label: '30d',  days: 30 },
  { label: '60d',  days: 60 },
  { label: '90d',  days: 90 },
  { label: '180d', days: 180 },
];

function DateRangePicker({
  filter, onChange,
}: {
  filter: ReportFilter;
  onChange: (f: ReportFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange({ days: p.days })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter.days === p.days
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Score trend chart ──────────────────────────────────────────────────────────

function ScoreTrendChart({ data }: { data: Array<{ date: string; score: number }> }) {
  if (!data.length) return <EmptyChart />;
  const sampled = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 30)) === 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={sampled} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
          tickFormatter={(v) => v.slice(5)} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
          tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v: number) => [`${v}%`, 'Score']}
        />
        <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2.5}
          dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Controls status donut ──────────────────────────────────────────────────────

function ControlsDonut({ breakdown }: { breakdown: { implemented: number; partiallyImplemented: number; notImplemented: number; planned: number; notApplicable: number } }) {
  const chartData = [
    { name: 'Implemented',    value: breakdown.implemented,          color: CHART_COLORS.implemented },
    { name: 'Partial',        value: breakdown.partiallyImplemented, color: CHART_COLORS.partial },
    { name: 'Not Implemented',value: breakdown.notImplemented,       color: CHART_COLORS.notImpl },
    { name: 'Planned',        value: breakdown.planned,              color: CHART_COLORS.planned },
    { name: 'N/A',            value: breakdown.notApplicable,        color: CHART_COLORS.notApplicable },
  ].filter((d) => d.value > 0);
  if (!chartData.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="value" cx="50%" cy="50%"
          innerRadius="55%" outerRadius="80%"
          paddingAngle={2} startAngle={90} endAngle={-270}>
          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Framework coverage bar ─────────────────────────────────────────────────────

function FrameworkBar({ coverage }: { coverage: FrameworkCoverage[] }) {
  if (!coverage.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={coverage} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="frameworkCode" width={80}
          tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v: number) => [`${v}%`, 'Coverage']} />
        <Bar dataKey="coveragePercent" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {coverage.map((f, i) => (
            <Cell key={i} fill={f.coveragePercent >= 80 ? '#16a34a' : f.coveragePercent >= 60 ? '#f59e0b' : '#dc2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Controls by criticality ────────────────────────────────────────────────────

function CriticalityChart({ data }: { data: ControlsByCriticality[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="criticality" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
          tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="implemented"   name="Implemented"    fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d, i) => <Cell key={i} fill={CRITICALITY_COLORS[d.criticality] ?? '#3b82f6'} />)}
        </Bar>
        <Bar dataKey="notImplemented" name="Not Implemented" fill="#dc262620" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Tasks donut ────────────────────────────────────────────────────────────────

function TasksDonut({ breakdown }: { breakdown: { todo: number; in_progress: number; in_review: number; completed: number; cancelled: number; blocked: number } }) {
  const chartData = [
    { name: 'To Do',       value: breakdown.todo,        color: CHART_COLORS.todo },
    { name: 'In Progress', value: breakdown.in_progress, color: CHART_COLORS.in_progress },
    { name: 'In Review',   value: breakdown.in_review,   color: CHART_COLORS.in_review },
    { name: 'Completed',   value: breakdown.completed,   color: CHART_COLORS.completed },
    { name: 'Blocked',     value: breakdown.blocked,     color: CHART_COLORS.blocked },
    { name: 'Cancelled',   value: breakdown.cancelled,   color: CHART_COLORS.cancelled },
  ].filter((d) => d.value > 0);
  if (!chartData.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="value" cx="50%" cy="50%"
          innerRadius="55%" outerRadius="80%" paddingAngle={2} startAngle={90} endAngle={-270}>
          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Evidence bar ───────────────────────────────────────────────────────────────

function EvidenceBar({ breakdown }: { breakdown: { active: number; archived: number; expired: number } }) {
  const chartData = [
    { name: 'Active',   count: breakdown.active,   fill: '#16a34a' },
    { name: 'Archived', count: breakdown.archived, fill: '#64748b' },
    { name: 'Expired',  count: breakdown.expired,  fill: '#dc2626' },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Scheduled Reports Modal ────────────────────────────────────────────────────

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const fmt = useOrgFormat();
  const { data: schedules = [], isLoading } = useScheduledReports();
  const create = useCreateScheduledReport();
  const update = useUpdateScheduledReport();
  const del    = useDeleteScheduledReport();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateScheduledReportDto>({
    name: '',
    frequency: 'weekly',
    dayOfWeek: 1,
    hour: 6,
    recipients: [],
    format: 'pdf',
  });
  const [recipientInput, setRecipientInput] = useState('');

  function addRecipient() {
    const email = recipientInput.trim();
    if (email && !form.recipients.includes(email)) {
      setForm((f) => ({ ...f, recipients: [...f.recipients, email] }));
    }
    setRecipientInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => { setShowForm(false); setForm({ name: '', frequency: 'weekly', dayOfWeek: 1, hour: 6, recipients: [], format: 'pdf' }); } });
  }

  function statusBadge(r: ScheduledReport) {
    if (!r.isActive) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Paused</span>;
    if (r.lastRunStatus === 'failed') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Failed</span>;
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Active</span>;
  }

  function freqLabel(r: ScheduledReport) {
    if (r.frequency === 'daily')   return `Daily at ${r.hour}:00`;
    if (r.frequency === 'weekly')  return `Weekly — ${DOW_LABELS[r.dayOfWeek ?? 1]} at ${r.hour}:00`;
    return `Monthly — day ${r.dayOfMonth ?? 1} at ${r.hour}:00`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Scheduled Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">Automatically deliver compliance reports via email</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Existing schedules */}
          {isLoading ? (
            <div className="space-y-3">{[1,2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : schedules.length === 0 && !showForm ? (
            <div className="text-center py-10 text-slate-400">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No scheduled reports yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                      {statusBadge(r)}
                    </div>
                    <p className="text-xs text-slate-500">{freqLabel(r)} · {r.format.toUpperCase()}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.recipients.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                          <Mail className="h-2.5 w-2.5 text-slate-400" />{email}
                        </span>
                      ))}
                    </div>
                    {r.nextRunAt && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Next: {fmt.formatDateTime(r.nextRunAt)}
                        {r.lastRunAt && ` · Last: ${fmt.formatDateTime(r.lastRunAt)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => update.mutate({ id: r.id, dto: { isActive: !r.isActive } })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600"
                      title={r.isActive ? 'Pause' : 'Activate'}
                    >
                      {r.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => del.mutate(r.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-4">
              <p className="text-xs font-semibold text-blue-800">New Scheduled Report</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 mb-1 block">Report Name *</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    placeholder="e.g. Monthly Executive Report" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 mb-1 block">Frequency *</label>
                  <select value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as any }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {form.frequency === 'weekly' && (
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 mb-1 block">Day of Week</label>
                    <select value={form.dayOfWeek ?? 1}
                      onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                      {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {form.frequency === 'monthly' && (
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 mb-1 block">Day of Month</label>
                    <input type="number" min={1} max={28} value={form.dayOfMonth ?? 1}
                      onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 mb-1 block">Send Hour (UTC)</label>
                  <select value={form.hour ?? 6}
                    onChange={(e) => setForm((f) => ({ ...f, hour: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 mb-1 block">Format</label>
                  <select value={form.format ?? 'pdf'}
                    onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as any }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="both">PDF + Excel</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 mb-1 block">Recipients *</label>
                  <div className="flex gap-2">
                    <input value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                      placeholder="email@company.com — press Enter to add"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <button type="button" onClick={addRecipient}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                      Add
                    </button>
                  </div>
                  {form.recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.recipients.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-700">
                          {email}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, recipients: f.recipients.filter((r) => r !== email) }))}>
                            <X className="h-2.5 w-2.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-white">
                  Cancel
                </button>
                <button type="submit" disabled={create.isPending || form.recipients.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {create.isPending ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </form>
          )}
        </div>

        {!showForm && (
          <div className="border-t border-slate-100 px-6 py-3 shrink-0">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> New Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function ExecutiveDashboardPage() {
  const fmt = useOrgFormat();
  const [filter, setFilter] = useState<ReportFilter>({ days: 90 });
  const [showSchedule, setShowSchedule] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useExecutiveDashboard(filter);
  // Named on the printed masthead so the sheet identifies which organisation
  // it covers once it is off the screen.
  const activeTenant = useAuthStore((s) => s.activeTenant);
  const pdf   = useDownloadPdf(filter);
  const excel = useDownloadExcel(filter);

  const scoreColor = data
    ? data.kpis.overallScore >= 80 ? 'green'
    : data.kpis.overallScore >= 60 ? 'amber'
    : 'red'
    : 'blue';

  return (
    <div className="h-full overflow-y-auto bg-slate-50 print:overflow-visible print:bg-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 print:max-w-none print:p-0">

        {/* ── Print masthead ────────────────────────────────────────────────────
            Only appears on paper. A printed compliance report that does not say
            which organisation it covers, over what period, and when it was
            generated is not evidence — it is a picture of some numbers. */}
        <div className="hidden print:mb-6 print:block print:border-b print:border-slate-300 print:pb-4">
          <h1 className="text-xl font-semibold text-slate-900">Compliance Report</h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeTenant?.name ?? 'Organisation'} · Period: last {filter.days ?? 90} days
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Generated {data ? fmt.formatDateTime(data.generatedAt) : fmt.formatDateTime(new Date())}
            {' · ComplianceCore'}
          </p>
        </div>

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div data-print="hide" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <h1 className="text-2xl font-semibold text-slate-900">Executive Dashboard</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {data
                ? `Last updated ${fmt.formatDateTime(data.generatedAt)}`
                : isError
                ? 'Failed to load compliance overview'
                : 'Loading compliance overview…'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker filter={filter} onChange={setFilter} />
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pdf.mutate()}
              loading={pdf.isPending}
              disabled={isLoading}
            >
              {!pdf.isPending && <FileDown />}
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => excel.mutate()}
              loading={excel.isPending}
              disabled={isLoading}
            >
              {!excel.isPending && <FileSpreadsheet />}
              Export Excel
            </Button>
            <Button size="sm" onClick={() => setShowSchedule(true)}>
              <Calendar />
              Scheduled reports
            </Button>
          </div>
        </div>

        {/* ── Error state ──────────────────────────────────────────────────── */}
        {isError && !isLoading && (
          <Card>
            <ErrorState
              title="We couldn't build your report"
              description="Your compliance data is safe — this is a problem reaching the reporting service, not a problem with your records."
              onRetry={() => refetch()}
            />
          </Card>
        )}

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-surface flex items-start gap-4 p-5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={TrendingUp} label="Compliance Score" value={`${data.kpis.overallScore}%`}
              sub={`${data.kpis.implementedControls} of ${data.kpis.totalControls} controls`}
              color={scoreColor} />
            <KpiCard icon={ShieldCheck} label="Implemented Controls" value={data.kpis.implementedControls}
              sub={`${data.kpis.notImplementedControls} not implemented`}
              color={data.kpis.notImplementedControls > 0 ? 'amber' : 'green'} />
            <KpiCard icon={CheckSquare} label="Overdue Tasks" value={data.kpis.overdueTasks}
              sub={`${data.kpis.openTasks} total open`}
              color={data.kpis.overdueTasks > 0 ? 'red' : 'green'} />
            <KpiCard icon={Clock} label="Expiring (30 days)" value={data.kpis.expiringIn30Days}
              sub={`${data.kpis.expiredItems} already expired`}
              color={data.kpis.expiringIn30Days > 0 ? 'amber' : 'green'} />
          </div>
        ) : null}

        {/* ── Charts Row 1 — Score Trend + Controls Donut ──────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartSkeleton className="lg:col-span-2" />
            <ChartSkeleton />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Compliance Score Trend" subtitle={`Last ${filter.days ?? 90} days`} />
              <div className="h-56 p-4">
                <ScoreTrendChart data={data.scoreTrend} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Controls by Status" />
              <div className="h-56 p-4">
                <ControlsDonut breakdown={data.controlsBreakdown} />
              </div>
            </Card>
          </div>
        ) : null}

        {/* ── Charts Row 2 — Framework Coverage + Tasks + Evidence ─────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Framework Coverage" subtitle="% controls implemented" />
              <div className="p-4 h-56">
                <FrameworkBar coverage={data.frameworkCoverage} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Tasks by Status" />
              <div className="p-4 h-56">
                <TasksDonut breakdown={data.tasksBreakdown} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Evidence by Status" />
              <div className="p-4 h-56">
                <EvidenceBar breakdown={data.evidenceBreakdown} />
              </div>
            </Card>
          </div>
        ) : null}

        {/* ── Charts Row 3 — Controls by Criticality ───────────────────────── */}
        {!isLoading && data && data.controlsByCriticality.length > 0 && (
          <Card>
            <CardHeader title="Controls by Criticality" subtitle="Implemented vs not implemented" />
            <div className="p-4 h-48">
              <CriticalityChart data={data.controlsByCriticality} />
            </div>
          </Card>
        )}

        {/* ── Tables — Framework Detail + Expiry Items ─────────────────────── */}
        {!isLoading && data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Framework detail table */}
            {data.frameworkCoverage.length > 0 && (
              <Card>
                <CardHeader title="Framework Detail" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Framework</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Controls</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Impl.</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.frameworkCoverage.map((f) => (
                        <tr key={f.frameworkId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[140px] truncate">{f.frameworkName}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{f.totalControls}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{f.implementedControls}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-semibold ${f.coveragePercent >= 80 ? 'text-green-600' : f.coveragePercent >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {f.coveragePercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Expiry items table */}
            {data.expiryOverview.upcoming.length > 0 && (
              <Card>
                <CardHeader title="Upcoming Expiry Items"
                  subtitle={`${data.expiryOverview.expiringSoon30} expiring in 30 days · ${data.expiryOverview.expired} expired`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Item</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Expires</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.expiryOverview.upcoming.map((item) => {
                        const expiryTs = new Date(item.expiryDate).getTime();
                        const validDate = !Number.isNaN(expiryTs);
                        const days = validDate ? Math.ceil((expiryTs - Date.now()) / 86400000) : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-700 truncate max-w-[150px]">{item.name}</p>
                              <p className="text-slate-400 text-[10px]">{item.entityType}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="text-slate-600">{validDate ? item.expiryDate : '—'}</p>
                              {days !== null && (
                                <p className={`text-[10px] font-medium ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {days <= 0 ? 'Expired' : `${days}d remaining`}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                item.status === 'expired' ? 'bg-red-100 text-red-700'
                                : item.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                              }`}>
                                {item.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Additional KPI Strip ──────────────────────────────────────────── */}
        {!isLoading && data && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Pending Approvals', value: data.kpis.pendingApprovals, color: data.kpis.pendingApprovals > 0 ? 'text-amber-600' : 'text-slate-800' },
              { label: 'Planned Controls',  value: data.kpis.plannedControls,  color: 'text-blue-600' },
              { label: 'Expiry (60 days)',  value: data.expiryOverview.expiringSoon60, color: data.expiryOverview.expiringSoon60 > 0 ? 'text-amber-600' : 'text-slate-800' },
              { label: 'Expiry (90 days)',  value: data.expiryOverview.expiringSoon90, color: data.expiryOverview.expiringSoon90 > 0 ? 'text-amber-600' : 'text-slate-800' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="px-4 py-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </Card>
            ))}
          </div>
        )}

      </div>

      {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} />}
    </div>
  );
}
