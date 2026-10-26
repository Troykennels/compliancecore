import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useFrameworks } from '../hooks/use-frameworks';
import { ImplementationOverview } from '../components/implementation-overview';
import { ComplianceWorkspace } from '../components/compliance-workspace';
import { assessmentInput as input, assessmentButton as button } from '../components/assessment-records';
export function FrameworksPage():JSX.Element {
 const [params,setParams]=useSearchParams();const id=params.get('framework')??'';
 const {data=[],isLoading,isError,refetch}=useFrameworks();const [search,setSearch]=useState('');
 return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header><h1 className="text-2xl font-bold text-slate-900">Compliance assessments</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Agree scope with stakeholders, assess risks, select the response, review applicable requirements and verify the supporting records. Follow the next action for the framework you need.</p></header>
 {id?<ComplianceWorkspace key={id} id={id} back={()=>setParams({})}/>:<><ImplementationOverview/><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Choose the requirements you need to assess</h2><input aria-label="Search frameworks" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a framework or law" className={input+' sm:max-w-xs'}/></div>{isLoading?<p>Loading requirements?</p>:isError?<button onClick={()=>void refetch()}>Retry catalogue</button>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.filter(f=>(f.name+' '+f.code).toLowerCase().includes(search.toLowerCase())).map(f=><article key={f.id} className="flex flex-col rounded-xl border bg-white p-5"><ShieldCheck className="mb-3 h-6 w-6 text-indigo-600"/><h3 className="font-semibold">{f.shortName||f.name}</h3><p className="mt-2 text-sm text-slate-500">{f.name} ? Catalogue edition {f.version||'not stated'}</p><p className="my-4 text-xs text-slate-500">{f.libraryControlCount} published reference controls ? {f.adoptedControlCount} existing organisation records</p><button className={button+' mt-auto'} onClick={()=>setParams({framework:f.id})}>Assess compliance <ArrowRight className="h-4 w-4"/></button><p className="mt-2 text-xs text-slate-500">Opens the assessment. Confirm the full current requirements and their applicability before drawing a conclusion.</p></article>)}</div>}</>}
 </div>;
}
