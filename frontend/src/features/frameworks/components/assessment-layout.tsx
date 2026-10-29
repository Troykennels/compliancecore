import type { ReactNode } from 'react';

/** Page header card: eyebrow, title, facts and actions in one bordered panel, so every assessment page opens the same way. */
export function AssessmentHeader({eyebrow,title,description,meta,actions}:{eyebrow:string;title:string;description?:ReactNode;meta?:ReactNode[];actions?:ReactNode}):JSX.Element {
 return <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
  <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
   {meta&&meta.length>0&&<p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">{meta.map((m,i)=><span key={i} className="inline-flex items-center">{m}</span>)}</p>}
   {description&&<p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}</div>
  {actions&&<div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
 </header>;
}

/** Status pill used in headers and tables. */
export function StatusBadge({status,label}:{status:string;label:string}):JSX.Element {
 const tone=status==='implemented'?'bg-emerald-50 text-emerald-800 border-emerald-200':status==='needs_attention'?'bg-amber-50 text-amber-900 border-amber-200':['in_review','ready_for_review'].includes(status)?'bg-sky-50 text-sky-900 border-sky-200':'bg-slate-50 text-slate-700 border-slate-200';
 return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

/** Bordered pill bar for the assessment phases. The current phase is filled. */
export function PhaseTabs({phases,current,onChange}:{phases:Array<{key:string;label:string;done:number;total:number}>;current:string;onChange:(key:string)=>void}):JSX.Element {
 return <nav aria-label="Assessment phases" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
  {phases.map(p=><button key={p.key} type="button" onClick={()=>onChange(p.key)} aria-current={p.key===current?'true':undefined} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${p.key===current?'bg-brand-600 text-white':'text-slate-700 hover:bg-brand-50'}`}>{p.label}<span className={`rounded-full px-1.5 text-[11px] ${p.key===current?'bg-white/20 text-white':p.done===p.total?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{p.done}/{p.total}</span></button>)}
 </nav>;
}

/** Small count chips, as in the assessment grid summary. */
export function CountChips({items}:{items:Array<{label:string;value:number|string;tone?:'neutral'|'good'|'warn'}>}):JSX.Element {
 return <ul className="flex flex-wrap gap-2">{items.map(i=><li key={i.label} className={`rounded-md border px-2.5 py-1 text-xs ${i.tone==='good'?'border-emerald-200 bg-emerald-50 text-emerald-800':i.tone==='warn'?'border-amber-200 bg-amber-50 text-amber-900':'border-slate-200 bg-slate-50 text-slate-700'}`}>{i.label}: <strong>{i.value}</strong></li>)}</ul>;
}
