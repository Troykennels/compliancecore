import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { organizationApi } from '@/features/organizations/api/organization.api';
import { useImplementationMembers, useImplementationOverview } from '@/features/frameworks/implementation';

const HIDE_KEY = 'cc:getting-started-hidden';

/** The compliance lifecycle as a checklist. Every tick comes from real records; nothing can be ticked by hand. */
export function GettingStarted(): JSX.Element | null {
  const overview = useImplementationOverview();
  const members = useImplementationMembers();
  const scoping = useQuery({ queryKey: ['organization', 'scoping'], queryFn: () => organizationApi.getScoping().then(r => r.data.data) });
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  if (overview.isLoading || members.isLoading || scoping.isLoading) return null;
  const all = overview.data ?? [];
  const gateDone = (key: string) => all.some(a => a.gates.some(g => g.key === key && g.done));
  const first = all[0]?.framework.id;
  const at = (step: string) => first ? `/frameworks?framework=${first}&step=${step}` : '/frameworks';
  const items: Array<{ label: string; done: boolean; to: string; action: string }> = [
    { label: 'Invite your team', done: (members.data?.length ?? 0) > 1, to: '/settings/team', action: 'Invite people' },
    { label: 'Answer the scoping questions', done: Boolean(scoping.data?.profile), to: '/settings/organization', action: 'Answer them' },
    { label: 'Start a compliance assessment', done: all.length > 0, to: '/frameworks', action: 'Start one' },
    { label: 'Assess the risks', done: gateDone('risk_assessment'), to: at('risk_assessment'), action: 'Open the risk step' },
    { label: 'Decide which requirements apply', done: gateDone('soa'), to: at('soa'), action: 'Open applicability' },
    { label: 'Attach supporting evidence', done: all.some(a => a.stats.evidenced > 0), to: at('evidence'), action: 'Add evidence' },
    { label: 'Record a control check', done: gateDone('testing'), to: at('testing'), action: 'Record a check' },
    { label: 'Request independent review', done: all.some(a => ['in_review', 'implemented'].includes(a.status)), to: at('signoff'), action: 'Request review' },
  ];
  const done = items.filter(i => i.done).length;
  if (done === items.length) return null;
  if (hidden) {
    return <button type="button" onClick={() => { setHidden(false); try { localStorage.removeItem(HIDE_KEY); } catch { /* private window */ } }} className="self-start text-xs font-semibold text-brand-700 underline">Show getting started ({done} of {items.length} done)</button>;
  }
  const next = items.find(i => !i.done)!;
  return (
    <section aria-label="Getting started" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Getting started</h2>
          <p className="mt-1 text-sm text-slate-600">{done} of {items.length} done. Next: <Link to={next.to} className="font-semibold text-brand-700 underline">{next.label.toLowerCase()}</Link>.</p>
        </div>
        <button type="button" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* private window */ } }} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Hide</button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, i) => (
          <li key={item.label} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${item.done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : item === next ? 'border-brand-300 bg-brand-50 text-slate-900' : 'border-slate-200 text-slate-700'}`}>
            {item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
            <span className="min-w-0"><span className="block font-medium">{i + 1}. {item.label}</span>
              {item.done ? <span className="text-xs">Done</span> : <Link to={item.to} className="text-xs font-semibold text-brand-700 underline">{item.action}</Link>}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
