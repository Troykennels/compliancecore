import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Mail, RefreshCw, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface Organisation {
  id: string; name: string; role: string; createdAt: string; joinedAt: string | null;
  phone: string | null; country: string | null; industry: string | null; plan: string | null;
  subscriptionStatus: string | null; trialEndsAt: string | null; paidThrough: string | null;
}
interface Signup {
  id: string; name: string; email: string; joinedAt: string; emailVerifiedAt: string | null;
  onboardingCompletedAt: string | null; isActive: boolean; lastSignInAt: string | null; lastActivityAt: string | null;
  evidence: { category: string; explanation: string };
  followup: { status: string; notes: string; followUpOn: string | null; updatedAt: string | null };
  organisations: Organisation[];
}
interface SignupReport {
  records: Signup[]; total: number; page: number; pageSize: number;
  summary: { unverified: number; activeTrials: number; expiredTrials: number; followupsDue: number };
}
const labels: Record<string, string> = { new: 'Not contacted', contacted: 'Contacted', interested: 'Interested', converted: 'Converted', not_interested: 'Not interested', test: 'Owner marked as test' };
const evidenceLabels: Record<string, string> = { demo: 'Default demo account', test_pattern: 'Test-pattern email', platform_owner: 'Platform owner', unclassified: 'Identity not reviewed' };
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded';
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WAT' : 'Not recorded';
function trialText(org: Organisation) {
  if (org.subscriptionStatus === 'trial') return org.trialEndsAt && Date.parse(org.trialEndsAt) <= Date.now() ? 'Trial ended' : 'Trial';
  return org.subscriptionStatus?.replace(/_/g, ' ') || 'No subscription';
}
function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^\s*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function SignupDirectory(): JSX.Element {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [stage, setStage] = useState('all'), [followup, setFollowup] = useState('all'), [days, setDays] = useState('0'), [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Signup | null>(null), [notes, setNotes] = useState(''), [review, setReview] = useState('new'), [due, setDue] = useState('');
  const [saving, setSaving] = useState(false), [exporting, setExporting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const qc = useQueryClient();
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (editing && !dialog.current?.open) dialog.current?.showModal(); else if (!editing && dialog.current?.open) dialog.current.close(); }, [editing]);
  const params = { search: query, stage, followup, days: Number(days), page, pageSize: 50 };
  const { data, isPending, isError, isFetching, refetch } = useQuery({ queryKey: ['billing', 'admin', 'signups', params], queryFn: async () => (await apiClient.get<{ data: SignupReport }>('/billing/admin/signups', { params })).data.data, staleTime: 30_000 });
  function edit(person: Signup, button: HTMLButtonElement) { trigger.current = button; setEditing(person); setNotes(person.followup.notes); setReview(person.followup.status); setDue(person.followup.followUpOn?.slice(0, 10) || ''); }
  async function save() {
    if (!editing || saving) return;
    setSaving(true);
    try { await apiClient.patch(`/billing/admin/signups/${editing.id}`, { status: review, notes, followUpOn: due || null }); await qc.invalidateQueries({ queryKey: ['billing', 'admin', 'signups'] }); toast.success('Follow-up saved.'); setEditing(null); }
    catch { toast.error('Follow-up could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }
  async function exportCSV() {
    setExporting(true);
    try {
      const records: Signup[] = [];
      for (let next = 1; ; next++) {
        const report = (await apiClient.get<{ data: SignupReport }>('/billing/admin/signups', { params: { ...params, page: next, pageSize: 100 } })).data.data;
        if (report.total > 10000) throw Error('Narrow the filters to export fewer than 10,000 accounts.');
        records.push(...report.records);
        if (next * 100 >= report.total || report.records.length === 0) break;
      }
      const rows: unknown[][] = [['Name', 'Email', 'Registered (WAT)', 'Email verified (WAT)', 'Organisation', 'Phone', 'Role', 'Subscription', 'Trial ends', 'Last recorded activity (WAT)', 'Evidence category', 'Follow-up', 'Follow-up date', 'Notes']];
      for (const person of records) for (const org of person.organisations.length ? person.organisations : [null]) rows.push([person.name, person.email, dateTime(person.joinedAt), dateTime(person.emailVerifiedAt), org?.name, org?.phone, org?.role, org ? trialText(org) : 'Setup not completed', date(org?.trialEndsAt || null), dateTime(person.lastActivityAt), evidenceLabels[person.evidence.category], labels[person.followup.status], person.followup.followUpOn?.slice(0, 10), person.followup.notes]);
      const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'compliancecore-signups.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast.success('Signup export downloaded.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Export failed. Please try again.'); }
    finally { setExporting(false); }
  }
  return <section className="space-y-5" aria-label="Signup and trial directory">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Signups &amp; trials</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Every registration, including unverified emails and unfinished setup. Dates use Lagos time.</p></div><div className="flex gap-2"><button onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh</button><button onClick={() => void exportCSV()} disabled={exporting || !data?.total} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Exporting…' : 'Export filtered CSV'}</button></div></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Matching accounts', data?.total], ['Email not verified', data?.summary.unverified], ['Active trials', data?.summary.activeTrials], ['Follow-ups due', data?.summary.followupsDue]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value ?? '—'}</p></div>)}</div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><span className="mb-1 block text-xs font-semibold text-slate-600">Find a person or organisation</span><Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" /><input aria-label="Search signups" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email or organisation" className={`${inputClass} pl-9`} /></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate-600">Registration stage</span><select aria-label="Registration stage" value={stage} onChange={event => { setStage(event.target.value); setPage(1); }} className={inputClass}><option value="all">All registrations</option><option value="unverified">Email not verified</option><option value="incomplete">Verified, setup incomplete</option><option value="trial">Active free trials</option><option value="expired_trial">Expired free trials</option></select></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate-600">Follow-up status</span><select aria-label="Follow-up status filter" value={followup} onChange={event => { setFollowup(event.target.value); setPage(1); }} className={inputClass}><option value="all">All follow-ups</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate-600">Joined</span><select aria-label="Signup date range" value={days} onChange={event => { setDays(event.target.value); setPage(1); }} className={inputClass}><option value="0">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
    </div>
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">A test-pattern email is a clue, not proof of who created the account. Review the contact details before marking it as a test. No account is deleted or contacted automatically.</p>
    {isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">Signups could not be loaded. <button className="font-semibold underline" onClick={() => void refetch()}>Try again</button></div> : isPending ? <div role="status" className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading registrations…</div> : <>
      <div className="space-y-3">{data.records.map(person => <article key={person.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{person.name}</h3><span title={person.evidence.explanation} className={`rounded-full px-2 py-0.5 text-xs font-medium ${person.evidence.category === 'unclassified' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-900'}`}>{evidenceLabels[person.evidence.category]}</span>{!person.isActive && <span className="text-xs text-red-700">Inactive</span>}</div><a className="mt-1 inline-flex max-w-full items-center gap-1.5 break-all text-sm text-indigo-700 underline-offset-2 hover:underline" href={`mailto:${encodeURIComponent(person.email)}`}><Mail className="h-3.5 w-3.5 shrink-0" />{person.email}</a></div><button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={event => edit(person, event.currentTarget)}>Manage follow-up</button></div>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><span className="block text-slate-500">Registered</span><strong className="mt-1 block font-semibold text-slate-800">{dateTime(person.joinedAt)}</strong></div><div><span className="block text-slate-500">Email verification</span><strong className={`mt-1 inline-flex items-center gap-1 font-semibold ${person.emailVerifiedAt ? 'text-emerald-700' : 'text-amber-700'}`}>{person.emailVerifiedAt && <CheckCircle2 className="h-3.5 w-3.5" />}{person.emailVerifiedAt ? date(person.emailVerifiedAt) : 'Not verified'}</strong></div><div title="From retained sessions. Older sign-ins may no longer be available."><span className="block text-slate-500">Last recorded activity</span><strong className="mt-1 block font-semibold text-slate-800">{dateTime(person.lastActivityAt)}</strong></div><div><span className="block text-slate-500">Follow-up</span><strong className="mt-1 block font-semibold text-slate-800">{labels[person.followup.status]}</strong>{person.followup.followUpOn && <span className="mt-1 inline-flex items-center gap-1 text-indigo-700"><CalendarDays className="h-3 w-3" />{date(person.followup.followUpOn)}</span>}</div></div>
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{person.organisations.length ? person.organisations.map(org => <div key={org.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><div><strong className="text-slate-800">{org.name}</strong><span className="ml-2 text-slate-500">{org.role} · {org.plan || 'Plan not set'}</span><p className="mt-1 text-slate-500">Organisation created {date(org.createdAt)}{org.phone ? ` · Phone: ${org.phone}` : ' · Phone not supplied'}</p></div><div className="text-slate-700"><strong>{trialText(org)}</strong>{org.trialEndsAt && <span className="ml-2">Trial ends: {date(org.trialEndsAt)}</span>}</div></div>) : <p className="text-xs text-slate-500">No organisation linked. {person.emailVerifiedAt ? 'Email verified; organisation setup is not complete.' : 'Email verification and organisation setup are pending.'}</p>}</div>
        {person.followup.notes && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-slate-700">{person.followup.notes}</p>}
      </article>)}</div>
      {!data.records.length && <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No registrations match these filters</p><button className="mt-2 text-sm font-semibold text-indigo-700" onClick={() => { setSearch(''); setStage('all'); setFollowup('all'); setDays('0'); setPage(1); }}>Clear filters</button></div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{data.total} matching accounts · Page {page} of {Math.max(1, Math.ceil(data.total / 50))}</span><div className="flex gap-2"><button aria-label="Previous signup page" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next signup page" disabled={page * 50 >= data.total} onClick={() => setPage(value => value + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer>
      <p className="text-xs text-slate-400">Activity comes from retained sign-in sessions; missing activity is not proof that someone never used the app. Phone numbers appear only when supplied in the organisation profile.</p>
    </>}
    <dialog ref={dialog} aria-labelledby="signup-followup-title" onCancel={event => { if (saving) event.preventDefault(); else setEditing(null); }} onClose={() => { setEditing(null); if (trigger.current?.isConnected) trigger.current.focus(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/50">
      {editing && <form onSubmit={event => { event.preventDefault(); void save(); }} className="p-6"><div className="flex items-start justify-between gap-3"><div><h3 id="signup-followup-title" className="text-lg font-bold text-slate-900">Manage follow-up</h3><p className="mt-1 break-all text-sm text-slate-500">{editing.email}</p></div><button type="button" aria-label="Close follow-up" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg p-1 text-slate-500"><X className="h-5 w-5" /></button></div><label className="mt-5 block text-sm font-medium text-slate-700">Status<select aria-label="Follow-up status" value={review} onChange={event => setReview(event.target.value)} className={`${inputClass} mt-1`}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">Follow-up date<input type="date" value={due} onChange={event => setDue(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="mt-4 block text-sm font-medium text-slate-700">Private owner notes<textarea maxLength={4000} rows={4} value={notes} onChange={event => setNotes(event.target.value)} className={`${inputClass} mt-1`} /></label><p className="mt-2 text-xs text-slate-500">Saved for the platform owner. Marking a test never deletes or changes the customer account.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save follow-up'}</button></div></form>}
    </dialog>
  </section>;
}
