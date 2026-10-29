import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { ModalSurface } from '@/components/modal-surface';
import { PageHeader, CountChips } from '@/components/page-header';
import { hasPermission } from '@/config/role-permissions';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import { useImplementationMembers } from '@/features/frameworks/implementation';
import { usePrivacyDecision, usePrivacyRegister, usePrivacySave, usePrivacySummary, type PrivacyRow } from './privacy.api';
import { REGISTERS, RISK_LABEL, STATUS_LABEL, type Field, type Register } from './privacy-registers';

const input = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50';
const primary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

export function PrivacyPage(): JSX.Element {
  const { pathname } = useLocation();
  const register = REGISTERS.find(r => r.path === pathname) ?? REGISTERS[0];
  const role = useAuthStore(s => s.activeTenant?.role);
  const canWrite = hasPermission(role, 'privacy:write');
  const summary = usePrivacySummary();
  const [editing, setEditing] = useState<PrivacyRow | null | undefined>();
  const s = summary.data;
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader eyebrow="Privacy" title={register.title} description={register.purpose}
        actions={canWrite ? <button className={primary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />{register.addLabel}</button> : undefined}>
        {s && <div className="mt-3"><CountChips items={[
          { label: 'Active processing records', value: s.activeActivities },
          { label: 'Open requests', value: s.openRequests },
          { label: 'Overdue requests', value: s.overdueRequests, tone: s.overdueRequests ? 'warn' : 'neutral' },
          { label: 'Impact assessments open', value: s.openAssessments },
        ]} /></div>}
      </PageHeader>
      <nav aria-label="Privacy registers" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
        {REGISTERS.map(r => <Link key={r.key} to={r.path} aria-current={r.key === register.key ? 'page' : undefined}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${r.key === register.key ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-brand-50'}`}>{r.tab}</Link>)}
      </nav>
      <RegisterTable key={register.key} register={register} canWrite={canWrite} edit={setEditing} />
      {editing !== undefined && <RegisterForm register={register} row={editing} canWrite={canWrite} close={() => setEditing(undefined)} />}
    </div>
  );
}

function useLabels() {
  const { data: members = [] } = useImplementationMembers();
  const activities = usePrivacyRegister('activities');
  const { formatDate } = useOrgFormat();
  const member = (id: unknown) => members.find(m => m.id === id)?.name ?? (id ? 'Former member' : 'Not assigned');
  const activity = (id: unknown) => (activities.data?.find(a => a.id === id)?.name as string | undefined) ?? (id ? 'Retired record' : 'Not linked');
  return { members, activities: activities.data ?? [], member, activity, formatDate };
}

function cell(register: Register, column: Register['columns'][number], row: PrivacyRow, labels: ReturnType<typeof useLabels>): string {
  const value = row[column.key];
  if (column.kind === 'date') return value ? labels.formatDate(String(value)) : '—';
  if (column.kind === 'member') return labels.member(value);
  if (column.kind === 'bool') return value ? 'Required' : 'Not required';
  if (column.kind === 'label') {
    if (column.key === 'activityId') return labels.activity(value);
    if (column.key === 'residualRisk') return RISK_LABEL[String(value)] ?? String(value);
    const field = register.fields.find(f => f.key === column.key);
    return field?.options?.find(([k]) => k === value)?.[1] ?? String(value ?? '—');
  }
  return String(value ?? '—');
}

function RegisterTable({ register, canWrite, edit }: { register: Register; canWrite: boolean; edit: (row: PrivacyRow) => void }): JSX.Element {
  const { data = [], isLoading, isError, refetch } = usePrivacyRegister(register.key);
  const labels = useLabels();
  const [search, setSearch] = useState('');
  const rows = data.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  return (
    <section aria-label={register.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <input aria-label={`Search ${register.title.toLowerCase()}`} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} className={input + ' sm:max-w-xs'} />
        <span className="text-xs text-slate-500">{data.length} record{data.length === 1 ? '' : 's'}</span>
      </div>
      {isLoading ? <p role="status" className="p-5 text-sm text-slate-500">Loading…</p>
        : isError ? <p className="p-5 text-sm"><button className="text-red-700 underline" onClick={() => void refetch()}>This register could not be loaded. Retry</button></p>
        : !rows.length ? <p className="p-5 text-sm text-slate-600">{data.length ? 'No record matches the search.' : register.empty}</p>
        : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr>{register.columns.map(c => <th key={c.key} scope="col" className="px-5 py-3 font-semibold">{c.label}</th>)}<th scope="col" className="px-5 py-3 font-semibold">Status</th><th scope="col" className="px-5 py-3"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-100 align-top">
              {register.columns.map(c => <td key={c.key} className="px-5 py-3 text-slate-700">{cell(register, c, r, labels)}</td>)}
              <td className="px-5 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${r.overdue ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{r.overdue ? 'Overdue' : STATUS_LABEL[r.status] ?? r.status}</span></td>
              <td className="px-5 py-3 text-right"><button className={secondary} onClick={() => edit(r)}>{canWrite ? 'Open' : 'View'}</button></td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  );
}

function initialValues(register: Register, row: PrivacyRow | null): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of register.fields) {
    const v = row?.[f.key];
    values[f.key] = f.type === 'bool' ? Boolean(v) : f.type === 'date' ? (v ? String(v).slice(0, 10) : '') : v ?? (f.options?.[0]?.[0] ?? '');
  }
  if (!row && register.key === 'requests') values.receivedOn = new Date().toISOString().slice(0, 10);
  return values;
}

function payload(register: Register, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of register.fields) {
    const v = values[f.key];
    out[f.key] = f.type === 'bool' ? Boolean(v) : v === '' ? (['date', 'member', 'activity'].includes(f.type) || !f.required ? null : '') : v;
  }
  if (register.key === 'requests' && !out.dueDate) delete out.dueDate;
  return out;
}

function RegisterForm({ register, row, canWrite, close }: { register: Register; row: PrivacyRow | null; canWrite: boolean; close: () => void }): JSX.Element {
  const [values, setValues] = useState(() => initialValues(register, row));
  const save = usePrivacySave(register.key);
  const decide = usePrivacyDecision();
  const labels = useLabels();
  const user = useAuthStore(s => s.user);
  const [note, setNote] = useState('');
  const set = (key: string, value: unknown) => setValues(v => ({ ...v, [key]: value }));
  const independent = row && user && row.ownerId !== user.id && row.createdBy !== user.id;
  return (
    <ModalSurface label={row ? register.title : register.addLabel} onClose={close} className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-6">
      <form className="mx-auto my-4 max-w-3xl space-y-5 rounded-xl bg-white p-5" onSubmit={e => { e.preventDefault(); save.mutate({ id: row?.id, data: payload(register, values) }, { onSuccess: close }); }}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{register.tab}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{row ? String(row.name ?? row.title ?? row.reference ?? register.title) : register.addLabel}</h2></div><button type="button" aria-label="Close" onClick={close}><X className="h-5 w-5" /></button></div>
        <fieldset disabled={!canWrite || save.isPending} className="grid gap-4 sm:grid-cols-2">
          {register.fields.map(f => <FormField key={f.key} field={f} value={values[f.key]} set={v => set(f.key, v)} labels={labels} />)}
        </fieldset>
        {register.key === 'assessments' && row && canWrite && (
          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Review</h3>
            <p className="text-xs text-slate-600">Status: {STATUS_LABEL[row.status] ?? row.status}. Save any changes first; changing an approved assessment returns it to draft.</p>
            <label className="block text-sm font-medium text-slate-700"><span>Decision note</span><textarea aria-label="Decision note" rows={2} className={input} value={note} onChange={e => setNote(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2">
              {row.status === 'draft' && <button type="button" className={secondary} disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'submit', note }, { onSuccess: close })}>Submit for review</button>}
              {row.status === 'in_review' && independent && <>
                <button type="button" className={primary} disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'approve', note }, { onSuccess: close })}>Approve</button>
                <button type="button" className={secondary} disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'reject', note }, { onSuccess: close })}>Reject</button>
                <button type="button" className={secondary} disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'return', note }, { onSuccess: close })}>Return for changes</button>
              </>}
              {row.status === 'in_review' && !independent && <p className="text-xs text-slate-600">A different authorised person must review this assessment.</p>}
            </div>
          </section>
        )}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondary} onClick={close}>Close</button>{canWrite && <button className={primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>}</div>
      </form>
    </ModalSurface>
  );
}

function FormField({ field, value, set, labels }: { field: Field; value: unknown; set: (v: unknown) => void; labels: ReturnType<typeof useLabels> }): JSX.Element {
  const wide = field.type === 'textarea' || field.type === 'bool';
  const label = <span>{field.label}{field.required && <span className="text-red-700"> *</span>}</span>;
  if (field.type === 'bool') return <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" className="mt-1" checked={Boolean(value)} onChange={e => set(e.target.checked)} />{label}</label>;
  const id = `privacy-${field.key}`;
  return (
    <div className={`space-y-1 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="block font-medium text-slate-700">{label}</label>
      {field.type === 'textarea' ? <textarea id={id} rows={3} className={input} value={String(value ?? '')} onChange={e => set(e.target.value)} required={field.required} />
        : field.type === 'select' ? <select id={id} className={input} value={String(value ?? '')} onChange={e => set(e.target.value)}>{field.options!.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        : field.type === 'member' ? <select id={id} className={input} value={String(value ?? '')} onChange={e => set(e.target.value)}><option value="">Not assigned</option>{labels.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        : field.type === 'activity' ? <select id={id} className={input} value={String(value ?? '')} onChange={e => set(e.target.value)}><option value="">Not linked</option>{labels.activities.map(a => <option key={a.id} value={a.id}>{String(a.name)}</option>)}</select>
        : <input id={id} type={field.type === 'date' ? 'date' : 'text'} className={input} value={String(value ?? '')} onChange={e => set(e.target.value)} required={field.required} list={field.suggestions ? id + '-options' : undefined} />}
      {field.suggestions && <datalist id={id + '-options'}>{field.suggestions.map(s => <option key={s} value={s} />)}</datalist>}
      {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
    </div>
  );
}
