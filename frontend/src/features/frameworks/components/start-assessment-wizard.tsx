import { humanize } from '@/lib/labels';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ModalSurface } from '@/components/modal-surface';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import type { Framework } from '../types/frameworks.types';
import { useImplementationMembers } from '../implementation';
import { objectiveSuggestions, scopeSuggestions, TARGET_OFFSETS, monthsFromToday } from '../assessment-suggestions';
import { AssessmentField as Field, assessmentInput as input, assessmentButton as button, assessmentSecondary as secondary } from './assessment-records';
import { SuggestSelect } from './suggest-select';

const STEPS=['Framework','Scope and objective','Owner and date','Confirm'];

/** Start an assessment in four short steps. Saving records the scope only; no applicability, control status or conclusion is set. */
export function StartAssessmentWizard({frameworks,started,initial,close,opened}:{frameworks:Framework[];started:Set<string>;initial?:string;close:()=>void;opened:(id:string)=>void}):JSX.Element {
 const user=useAuthStore(s=>s.user);const {data:members=[]}=useImplementationMembers();const {formatDate}=useOrgFormat();const qc=useQueryClient();
 const [step,setStep]=useState(initial?1:0);const [frameworkId,setFrameworkId]=useState(initial??'');
 const [scope,setScope]=useState('');const [objective,setObjective]=useState('');const [ownerId,setOwnerId]=useState(user?.id??'');const [targetDate,setTargetDate]=useState(monthsFromToday(3));
 const [prepare,setPrepare]=useState(true);const [busy,setBusy]=useState(false);
 const framework=frameworks.find(f=>f.id===frameworkId);const code=framework?.code??'';
 const checks={framework:!framework?'Choose the framework or law.':'',scope:scope.trim().length<30?'Describe the scope in at least 30 characters.':'',objective:objective.trim().length<20?'State what the assessment should establish in at least 20 characters.':'',owner:!ownerId?'Choose the accountable owner.':'',date:!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)?'Choose a target review date.':''};
 const problems=Object.values(checks).filter(Boolean);
 const stepProblems=[[checks.framework],[checks.scope,checks.objective],[checks.owner,checks.date],problems][step].filter(Boolean);
 const save=async()=>{
  if(!framework||problems.length)return;setBusy(true);
  try{
   await apiClient.put(`/frameworks/${framework.id}/implementation`,{scope:scope.trim(),objective:objective.trim(),ownerId,targetDate});
   if(prepare&&framework.libraryControlCount>0)await apiClient.post(`/frameworks/${framework.id}/implementation/start`);
   for(const key of ['implementation','frameworks','controls','dashboard'])void qc.invalidateQueries({queryKey:[key]});
   toast.success('Assessment started. Continue with the next step.');opened(framework.id);
  }catch(e){toast.error((e as {response?:{data?:{error?:{message?:string}}}}).response?.data?.error?.message??'The assessment could not be started. Please retry.');}
  finally{setBusy(false);}
 };
 return <ModalSurface label="Start a compliance assessment" onClose={close} className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-6">
  <div className="mx-auto my-4 max-w-3xl rounded-xl bg-white">
   <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Start an assessment</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{STEPS[step]}</h2></div><button type="button" aria-label="Close" onClick={close}><X className="h-5 w-5"/></button></div>
   <ol aria-label="Wizard steps" className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">{STEPS.map((label,i)=><li key={label} aria-current={i===step?'step':undefined} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${i===step?'border-brand-600 bg-white font-semibold text-brand-900':i<step?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-slate-200 bg-white text-slate-500'}`}><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${i===step?'bg-brand-600 text-white':i<step?'bg-emerald-600 text-white':'bg-slate-100'}`}>{i+1}</span>{label}</li>)}</ol>
   <div className="space-y-4 p-5">
    {step===0&&<><Field label="Framework or law to assess"><select className={input} value={frameworkId} onChange={e=>setFrameworkId(e.target.value)}><option value="">Choose a framework or law</option>{frameworks.map(f=><option key={f.id} value={f.id}>{(f.shortName||f.name)+' · '+(f.version?'edition '+f.version:'edition not stated')+(started.has(f.id)?' · already in progress':'')}</option>)}</select></Field>
     {framework&&<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">{framework.name}</p><p className="mt-1">{framework.description||'No description recorded.'}</p><p className="mt-2 text-xs text-slate-500">{framework.libraryControlCount} published reference controls · {framework.issuingBody??'Issuer not stated'}{framework.jurisdiction?' · '+framework.jurisdiction:''}</p>{started.has(framework.id)&&<p className="mt-2 text-amber-800">An assessment is already in progress. Continuing replaces its saved scope with what you enter here.</p>}{framework.libraryControlCount===0&&<p className="mt-2 text-amber-800">This catalogue entry has no published requirements yet. You can record the scope, but the requirements must be added before they can be assessed.</p>}</div>}</>}
    {step===1&&<><Field label="Scope: services, records, systems, locations and boundaries"><SuggestSelect label="Choose a suggested scope" options={scopeSuggestions(code)} value={scope} onPick={setScope}/><textarea aria-label="Assessment scope" rows={4} maxLength={5000} className={input} value={scope} onChange={e=>setScope(e.target.value)}/></Field><p className="-mt-2 text-xs text-slate-500">Suggested wording is a starting point. Replace any [bracketed] part with the organisation's actual details.</p>
     <Field label="What should the assessment establish?"><SuggestSelect label="Choose a suggested objective" options={objectiveSuggestions(code)} value={objective} onPick={setObjective}/><textarea aria-label="Assessment objective" rows={3} maxLength={3000} className={input} value={objective} onChange={e=>setObjective(e.target.value)}/></Field></>}
    {step===2&&<><Field label="Accountable assessment owner"><select className={input} value={ownerId} onChange={e=>setOwnerId(e.target.value)}><option value="">Choose a member</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}{m.role?' · '+humanize(m.role):''}</option>)}</select></Field>
     <div className="grid gap-3 sm:grid-cols-2"><Field label="Target review date"><input type="date" className={input} value={targetDate} onChange={e=>setTargetDate(e.target.value)}/></Field><Field label="Quick choice"><select aria-label="Quick choice of target date" className={input} value="" onChange={e=>{if(e.target.value)setTargetDate(monthsFromToday(Number(e.target.value)));}}><option value="">Choose a period…</option>{TARGET_OFFSETS.map(([label,months])=><option key={label} value={months}>{label}</option>)}</select></Field></div>
     <p className="text-xs text-slate-500">The owner is accountable for the assessment. A different authorised person reviews and signs it off later.</p></>}
    {step===3&&framework&&<><dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]"><dt className="text-slate-500">Framework</dt><dd className="font-medium">{framework.shortName||framework.name}</dd><dt className="text-slate-500">Scope</dt><dd className="whitespace-pre-line">{scope.trim()}</dd><dt className="text-slate-500">Objective</dt><dd className="whitespace-pre-line">{objective.trim()}</dd><dt className="text-slate-500">Owner</dt><dd>{members.find(m=>m.id===ownerId)?.name??'Not chosen'}</dd><dt className="text-slate-500">Target review</dt><dd>{targetDate?formatDate(targetDate):'Not chosen'}</dd></dl>
     {framework.libraryControlCount>0&&<label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" className="mt-1" checked={prepare} onChange={e=>setPrepare(e.target.checked)}/><span>Also prepare the assessment register. This adds the published requirements for assessment and keeps existing records; it does not decide applicability or mark anything as complete.</span></label>}
     <p className="text-xs text-slate-500">Starting records the scope only. The next steps are stakeholder consultation, obligations and the risk assessment.</p></>}
    {stepProblems.length>0&&step>0&&<ul role="status" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{stepProblems.map(p=><li key={p}>{p}</li>)}</ul>}
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-5"><button type="button" className={secondary} onClick={()=>step?setStep(step-1):close()}>{step?<><ArrowLeft className="h-4 w-4"/>Back</>:'Cancel'}</button><span className="text-xs text-slate-500">Step {step+1} of {STEPS.length}</span>
    {step<3?<button type="button" className={button} disabled={stepProblems.length>0} onClick={()=>setStep(step+1)}>Continue <ArrowRight className="h-4 w-4"/></button>:<button type="button" className={button} disabled={busy||problems.length>0} onClick={()=>void save()}>{busy?'Starting…':'Start assessment'}</button>}</div>
  </div>
 </ModalSurface>;
}
