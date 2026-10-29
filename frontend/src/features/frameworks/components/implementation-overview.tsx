import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, ClipboardCheck } from 'lucide-react';
import { useImplementationOverview, implementationLabels } from '../implementation';
export function ImplementationOverview({ compact = false }: { compact?: boolean }): JSX.Element {
  const { data = [], isLoading, isError, refetch } = useImplementationOverview();
  const sorted = [...data].sort((a, b) => Number(b.status === 'needs_attention') - Number(a.status === 'needs_attention') || b.stats.overdue - a.stats.overdue);
  const visible = compact ? sorted.slice(0, 4) : sorted;
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5" aria-label="Assessment next steps">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-brand-600" />{compact ? 'Your next steps' : 'Assessment progress'}</h2><p className="mt-1 text-xs text-slate-500">Open a framework to continue its next unfinished step.</p></div>
      <Link className="text-xs font-semibold text-brand-700" to="/frameworks">View assessments <ArrowRight className="inline h-3 w-3" /></Link>
    </div>
    {isLoading ? <p role="status" className="py-8 text-sm text-slate-500">Loading assessment records...</p> : isError ? <button className="my-5 text-sm text-red-700 underline" onClick={() => void refetch()}>Assessment progress could not be loaded. Retry</button> : !data.length ? <div className="my-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><p>Start by agreeing your scope and the requirements that apply.</p><Link to="/frameworks" className="mt-3 inline-flex items-center gap-1 font-semibold underline">Start an assessment <ArrowRight className="h-4 w-4" /></Link></div> : <>
      {!compact && <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['In scope', data.length], ['Reviewed', data.filter(x => x.status === 'implemented').length], ['Awaiting sign-off', data.filter(x => x.status === 'in_review').length], ['Controls without evidence', data.reduce((n, x) => n + x.stats.applicable - x.stats.evidenced, 0)]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>}
      <div className="mt-4 space-y-2">{visible.map(x => {
        const next = x.gates.find(g => !g.done);
        const complete = x.gates.filter(g => g.done).length;
        const reviewed = x.status === 'implemented';
        return <Link key={x.framework.id} to={`/frameworks?framework=${x.framework.id}`} className="group block rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{x.framework.short_name || x.framework.name}</span>{reviewed ? <CheckCircle className="h-4 w-4 shrink-0 text-green-600" /> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{x.status === 'needs_attention' ? 'Review needed' : ['in_review', 'ready_for_review'].includes(x.status) ? 'Awaiting review' : 'In progress'}</span>}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{reviewed ? 'Monitor changes and the next review date.' : `Next: ${next?.title ?? 'Independent reviewer sign-off'}`}</p>
          <div className="mt-2 flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${reviewed ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${x.gates.length ? (complete / x.gates.length) * 100 : 0}%` }} /></div><span className="shrink-0 text-[10px] text-slate-500">{complete}/{x.gates.length} steps</span><ArrowRight className="h-3 w-3 text-brand-600" /></div>
          {!compact && <p className="mt-2 text-xs text-slate-500">{implementationLabels[x.status]} · {x.stats.unassigned} unassigned · {x.stats.overdue} overdue</p>}
        </Link>;
      })}</div>
      {compact && data.length > visible.length && <Link to="/frameworks" className="mt-3 block text-xs font-semibold text-brand-700">See all {data.length} assessments</Link>}
    </>}
    {!compact && <p className="mt-4 text-xs leading-relaxed text-slate-500">Internal assessment review is separate from certification, accreditation or external attestation.</p>}
  </section>;
}
