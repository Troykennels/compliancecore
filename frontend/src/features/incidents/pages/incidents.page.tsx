import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Flame, Loader2, Plus, AlertTriangle, ShieldAlert, Clock, RefreshCw, X,
} from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import { incidentsApi } from '../api/incidents.api';
import type {
  Incident, IncidentFilters, IncidentSeverity, IncidentStatus, IncidentCategory,
} from '../types/incidents.types';

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  critical: 'bg-rose-100 text-rose-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-600',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  open:          'bg-rose-100 text-rose-700',
  investigating: 'bg-amber-100 text-amber-700',
  contained:     'bg-sky-100 text-sky-700',
  resolved:      'bg-emerald-100 text-emerald-700',
  closed:        'bg-slate-100 text-slate-600',
};

const CATEGORIES: IncidentCategory[] = [
  'security', 'privacy', 'availability', 'integrity', 'third_party', 'physical', 'fraud', 'other',
];
const SEVERITIES: IncidentSeverity[] = ['critical', 'high', 'medium', 'low'];
const STATUSES: IncidentStatus[] = ['open', 'investigating', 'contained', 'resolved', 'closed'];

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function IncidentsPage(): JSX.Element {
  const qc = useQueryClient();
  const fmt = useOrgFormat();
  const [filters, setFilters] = useState<IncidentFilters>({ page: 1, limit: 50 });
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);

  const statsQuery = useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: () => incidentsApi.stats().then((r) => r.data.data),
  });

  const listQuery = useQuery({
    queryKey: ['incidents', 'list', filters],
    queryFn: () => incidentsApi.list(filters).then((r) => r.data.data),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['incidents'] });
  };

  const stats = statsQuery.data;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Flame className="h-5 w-5 text-rose-600" /> Incidents
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Security and privacy incident register, with statutory breach-notification tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          <Plus className="h-4 w-4" /> Report incident
        </button>
      </div>

      {/* Breach-notification warning takes priority over everything else: this is
          the one number on the page with a legal deadline attached. */}
      {!!stats?.overdueNotifications && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              {stats.overdueNotifications} breach{stats.overdueNotifications === 1 ? '' : 'es'} past the notification deadline
            </p>
            <p className="text-xs text-rose-800">
              GDPR Article 33 and the NDPA require notification within the stated window of becoming
              aware. Record the notification date on each incident as soon as it is sent.
            </p>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, overdueNotification: true, page: 1 }))}
              className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              Show these
            </button>
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total" value={stats?.total} />
        <StatTile label="Open" value={stats?.open} tone="rose" />
        <StatTile label="Investigating" value={stats?.investigating} tone="amber" />
        <StatTile label="Critical" value={stats?.critical} tone="rose" />
        <StatTile label="Data breaches" value={stats?.dataBreaches} tone="amber" />
        <StatTile
          label="Mean time to resolve"
          value={stats?.meanTimeToResolveHours ?? undefined}
          suffix={stats?.meanTimeToResolveHours != null ? 'h' : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.q ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined, page: 1 }))}
          placeholder="Search reference, title or description…"
          className="min-w-56 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, status: (v || undefined) as IncidentStatus, page: 1 }))}
          placeholder="All statuses"
          options={STATUSES}
        />
        <FilterSelect
          value={filters.severity ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, severity: (v || undefined) as IncidentSeverity, page: 1 }))}
          placeholder="All severities"
          options={SEVERITIES}
        />
        <FilterSelect
          value={filters.category ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, category: (v || undefined) as IncidentCategory, page: 1 }))}
          placeholder="All categories"
          options={CATEGORIES}
        />
        {(filters.q || filters.status || filters.severity || filters.category || filters.overdueNotification) && (
          <button
            type="button"
            onClick={() => setFilters({ page: 1, limit: 50 })}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {listQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-rose-600" /></div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
            <AlertTriangle className="h-7 w-7 text-slate-300" />
            <p className="text-sm">Could not load incidents.</p>
            <button
              onClick={() => void listQuery.refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : !listQuery.data?.incidents.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No incidents recorded</p>
            <p className="max-w-sm text-xs text-slate-500">
              An empty register is a good sign — but auditors will expect evidence that you can
              detect and record incidents when they do happen.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Detected</th>
                  <th className="px-4 py-2.5 font-medium">Breach</th>
                  <th className="px-4 py-2.5 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listQuery.data.incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelected(inc)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{inc.reference}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{inc.title}</span>
                      <span className="ml-2 text-xs text-slate-400">{titleCase(inc.category)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={SEVERITY_STYLES[inc.severity]}>{titleCase(inc.severity)}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLES[inc.status]}>{titleCase(inc.status)}</Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {fmt.formatDateTime(inc.detectedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {inc.isDataBreach ? (
                        inc.notificationOverdue ? (
                          <Pill className="bg-rose-100 text-rose-700">
                            <Clock className="mr-1 inline h-3 w-3" />Overdue
                          </Pill>
                        ) : inc.regulatorNotifiedAt ? (
                          <Pill className="bg-emerald-100 text-emerald-700">Notified</Pill>
                        ) : (
                          <Pill className="bg-amber-100 text-amber-700">Due</Pill>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{inc.assignedToName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ReportIncidentModal
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); invalidate(); }}
        />
      )}
      {selected && (
        <IncidentDetailModal
          incident={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { invalidate(); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Pill({ children, className }: { children: React.ReactNode; className: string }): JSX.Element {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

function StatTile({ label, value, tone, suffix }: {
  label: string; value?: number; tone?: 'rose' | 'amber'; suffix?: string;
}): JSX.Element {
  const toneCls = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${toneCls}`}>
        {value ?? '—'}{value !== undefined && suffix ? suffix : ''}
      </p>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[];
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
    </select>
  );
}

// ── Report modal ─────────────────────────────────────────────────────────────

function ReportIncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }): JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('security');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [isDataBreach, setIsDataBreach] = useState(false);
  const [affected, setAffected] = useState('');

  const create = useMutation({
    mutationFn: () => incidentsApi.create({
      title,
      description: description || null,
      category,
      severity,
      isDataBreach,
      affectedDataSubjects: isDataBreach && affected ? Number(affected) : null,
    }),
    onSuccess: () => { toast.success('Incident recorded.'); onCreated(); },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) =>
      toast.error(err.response?.data?.error?.message ?? 'Could not record the incident.'),
  });

  const field = 'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500';

  return (
    <Modal title="Report an incident" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
            placeholder="Short description of what happened" className={field} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">What happened?</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="Facts known so far. This becomes the first entry in the incident record."
            className={field} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory)} className={field}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} className={field}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <input type="checkbox" checked={isDataBreach} onChange={(e) => setIsDataBreach(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
          <span className="text-xs text-amber-900">
            <strong>This involves personal data.</strong> Ticking this starts a 72-hour
            notification clock from now, in line with GDPR Article 33 and the NDPA.
          </span>
        </label>

        {isDataBreach && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">
              Approximate number of people affected
            </span>
            <input type="number" min={0} value={affected} onChange={(e) => setAffected(e.target.value)}
              placeholder="Leave blank if not yet known" className={field} />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={!title || create.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Record incident
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function IncidentDetailModal({ incident, onClose, onChanged }: {
  incident: Incident; onClose: () => void; onChanged: () => void;
}): JSX.Element {
  const [note, setNote] = useState('');
  const fmt = useOrgFormat();

  const updatesQuery = useQuery({
    queryKey: ['incidents', incident.id, 'updates'],
    queryFn: () => incidentsApi.updates(incident.id).then((r) => r.data.data),
  });

  const patch = useMutation({
    mutationFn: (input: Parameters<typeof incidentsApi.update>[1]) =>
      incidentsApi.update(incident.id, input),
    onSuccess: () => { toast.success('Incident updated.'); onChanged(); },
    onError: () => toast.error('Could not update the incident.'),
  });

  const addNote = useMutation({
    mutationFn: () => incidentsApi.addUpdate(incident.id, note),
    onSuccess: () => { setNote(''); void updatesQuery.refetch(); },
    onError: () => toast.error('Could not add the note.'),
  });

  const field = 'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500';

  return (
    <Modal title={`${incident.reference} — ${incident.title}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={incident.status} className={field}
            onChange={(e) => patch.mutate({ status: e.target.value as IncidentStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select value={incident.severity} className={field}
            onChange={(e) => patch.mutate({ severity: e.target.value as IncidentSeverity })}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          {patch.isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>

        {incident.description && (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {incident.description}
          </p>
        )}

        {/* Breach notification panel — the regulated part of the record. */}
        {incident.isDataBreach && (
          <div className={`rounded-lg border p-3 ${
            incident.notificationOverdue ? 'border-rose-300 bg-rose-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <p className="text-sm font-semibold text-slate-900">Personal data breach</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
              <dt>People affected</dt>
              <dd>{incident.affectedDataSubjects ?? 'Not yet known'}</dd>
              <dt>Notification due</dt>
              <dd>
                {fmt.formatDateTime(incident.notificationDueAt)}
                {incident.notificationOverdue && (
                  <span className="ml-1 font-semibold text-rose-700">overdue</span>
                )}
              </dd>
              <dt>Regulator notified</dt>
              <dd>
                {fmt.formatDateTime(incident.regulatorNotifiedAt, 'Not yet')}
              </dd>
              <dt>Data subjects notified</dt>
              <dd>
                {fmt.formatDateTime(incident.dataSubjectsNotifiedAt, 'Not yet')}
              </dd>
            </dl>
            <div className="mt-2 flex flex-wrap gap-2">
              {!incident.regulatorNotifiedAt && (
                <button type="button"
                  onClick={() => patch.mutate({ regulatorNotifiedAt: new Date().toISOString() })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-50">
                  Mark regulator notified
                </button>
              )}
              {!incident.dataSubjectsNotifiedAt && (
                <button type="button"
                  onClick={() => patch.mutate({ dataSubjectsNotifiedAt: new Date().toISOString() })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-50">
                  Mark data subjects notified
                </button>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">Timeline</p>
          <div className="mb-2 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add an entry…"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            <button type="button" disabled={!note || addNote.isPending} onClick={() => addNote.mutate()}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
              Add
            </button>
          </div>
          {updatesQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <ul className="space-y-2">
              {updatesQuery.data?.map((u) => (
                <li key={u.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-sm text-slate-800">{u.body}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {titleCase(u.entryType)} · {u.authorName ?? 'System'} ·{' '}
                    {fmt.formatDateTime(u.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}): JSX.Element {
  return (
    // The only modal in the app that was top-aligned rather than centred, so it
    // sat noticeably higher than every other dialog. The outer element owns the
    // scrolling and the inner flex centres within `min-h-full`: short content
    // sits in the middle, tall content scrolls without the top being clipped —
    // which is what plain `items-center` + `overflow-y-auto` gets wrong.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl border border-slate-200 bg-white shadow-xl`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
