import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Download, Search } from 'lucide-react';
import { guideSections } from './guide-content';
import DepartmentGuide from './DepartmentGuide';
import { useAuthStore } from '@/stores/auth.store';

export function CompleteGuidePage() {
  const [query, setQuery] = useState('');
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    setQuery('');
    const timer = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }), 0);
    return () => window.clearTimeout(timer);
  }, [location.hash]);
  const visible = guideSections.filter(section => [section.title, section.summary, ...section.steps, section.example || ''].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  function download() {
    const content = 'COMPLIANCECORE — END-TO-END USER GUIDE\nBy Orion Soft Limited\n\n' + guideSections.map(section => `${section.title}\n${section.summary}\n\n${section.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n${section.example ? `\nExample: ${section.example}\n` : ''}\n${section.links.map(link => `${link.label}: ${window.location.origin}${link.to}`).join('\n')}`).join('\n\n--------------------\n\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ComplianceCore-User-Guide.txt'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700"><BookOpen className="h-4 w-4" /> Orion Soft Limited</p><h1 className="text-2xl font-bold text-slate-900">User guide</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">From your first setup to daily work, approvals, signatures and management reports. Follow the steps in order, or search for the task you need.</p></div>
      <button onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"><Download className="h-4 w-4" /> Download guide</button>
    </header>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-950">Start with setup and billing, then follow one complete example: requirement → owner action → evidence → review decision → management report. Your role and plan determine which actions are available.</div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search user guide" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search billing, signatures, renewals…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm" /></div>
    <nav aria-label="Guide chapters" className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">{guideSections.map(section => <Link key={section.id} to={`/guide#${section.id}`} onClick={() => setQuery('')} className="rounded px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">{section.title}</Link>)}</nav>
    <p role="status" className="text-xs text-slate-500">{visible.length} of {guideSections.length} chapters</p>
    {visible.length === 0 && <p className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">No matching chapter. Try “signature”, “payment” or “notification”.</p>}
    {visible.map(section => <section key={section.id} id={section.id} className="scroll-mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{section.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{section.summary}</p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">{section.steps.map(step => <li key={step} className="pl-1">{step}</li>)}</ol>
      {section.example && <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"><strong>Example: </strong>{section.example}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{section.links.map(link => <Link key={link.to} to={link.to} className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">Open {link.label}</Link>)}</div>
    </section>)}
  </div>;
}

const departmentDefinitions = [
  {key:'compliance',label:'Compliance manager',roles:['compliance_manager'],ids:['start','frameworks','policies','evidence','risks','tasks','approvals','signatures','renewals','assurance','incidents','notifications','reports','routine']},
  {key:'owner',label:'Organisation owner / administrator',roles:['owner','admin','msp_admin'],ids:['start','billing','frameworks','approvals','signatures','notifications','reports','integrations','routine']},
  {key:'control',label:'Control owners and department teams',roles:['control_owner'],ids:['start','frameworks','evidence','tasks','approvals','signatures','renewals','notifications','routine']},
  {key:'audit',label:'Audit and assurance',roles:['auditor'],ids:['start','frameworks','evidence','risks','assurance','signatures','reports','routine']},
  {key:'risk',label:'Risk, incident and supplier teams',roles:[],ids:['start','risks','incidents','tasks','evidence','renewals','routine']},
  {key:'learning',label:'HR and training',roles:[],ids:['start','assurance','policies','tasks','notifications','routine']},
  {key:'finance',label:'Billing and subscriptions',roles:[],ids:['start','billing','notifications','routine']},
  {key:'management',label:'Management / read-only review',roles:['viewer','msp_analyst'],ids:['start','reports','evidence','notifications','routine']},
  {key:'complete',label:'Complete workflow',roles:[],ids:guideSections.map(s=>s.id)},
];
const departmentContent = {product:'ComplianceCore',departments:departmentDefinitions.map(d=>({
  ...d,sections:d.ids.map(id=>guideSections.find(s=>s.id===id)).filter((s):s is NonNullable<typeof s>=>Boolean(s)).map(s=>({
    id:s.id,title:s.title.replace(/^\d+\. /,''),why:s.summary,where:s.links.map(l=>l.label),steps:s.steps,
    tips:s.example ? [s.example] : [],
  })),
}))};
export function GuidePage(){
  const role=useAuthStore(s=>s.activeTenant?.role) || '';
  const location=useLocation();
  const [complete,setComplete]=useState(()=>!!location.hash);
  useEffect(()=>{if(location.hash)setComplete(true);},[location.hash]);
  return <><div className="px-4 pt-4"><button type="button" onClick={()=>setComplete(!complete)} className="rounded-lg border px-3 py-2 text-sm">{complete?'Back to My Guide':'Open complete guide with page links and download'}</button></div>{complete?<CompleteGuidePage/>:<DepartmentGuide key={role} content={departmentContent} role={role} canTrain={['owner','admin','compliance_manager','msp_admin'].includes(role)}/>}</>;
}
