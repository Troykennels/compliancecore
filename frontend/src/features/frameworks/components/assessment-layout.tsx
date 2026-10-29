import { PageHeader, CountChips } from '@/components/page-header';

/** Assessment pages use the shared page header. */
export const AssessmentHeader = PageHeader;
export { CountChips };

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
