import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ModalSurface } from '@/components/modal-surface';
import { AccessibleField } from '@/components/accessible-field';
import { PermissionAction } from '@/components/permission-action';
import { useImplementationMembers } from '@/features/frameworks/implementation';
import { useTrainingRecords, useAssignTrainingRecords } from '../hooks/use-training';
import type { TrainingProgram } from '../types/training.types';
import { TRAINING_RECORD_STATUS_CONFIG } from '../types/training.types';

export function TrainingParticipantsModal({program,onClose}:{program:TrainingProgram;onClose:()=>void}) {
 const records=useTrainingRecords(program.id), members=useImplementationMembers(), assign=useAssignTrainingRecords();
 const [selected,setSelected]=useState<string[]>([]),[dueDate,setDueDate]=useState(''),[search,setSearch]=useState('');
 const existing=new Set((records.data??[]).map(r=>r.userId));
 const ready=!records.isLoading&&!members.isLoading&&!records.isError&&!members.isError;
 return <ModalSurface label="Training participants and assignments" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
  <section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-xl">
   <div className="flex justify-between gap-4"><div><h2 className="text-lg font-semibold">Participants and assignments</h2><p className="text-sm text-slate-600">{program.title}</p></div><button aria-label="Close participants" onClick={onClose}><X/></button></div>
   <p className="my-4 text-sm text-slate-600">1. Assign people and a due date. 2. Run the training. 3. Upload attendance or assessment proof and verify completion in <Link className="text-indigo-700 underline" to="/training?workflow=training" onClick={onClose}>Training proof</Link>. Assigning someone does not mark their training complete.</p>
   {(records.isError||members.isError)&&<div role="alert" className="rounded bg-red-50 p-3 text-red-800">Could not load participants. <button className="underline" onClick={()=>{void records.refetch();void members.refetch();}}>Try again</button></div>}
   {(records.isLoading||members.isLoading)&&<p role="status">Loading participants...</p>}
   <PermissionAction scope="training:write"><form className="my-4 space-y-3 rounded-lg border p-4" onSubmit={e=>{e.preventDefault();if(!ready||!selected.length||program.status!=='active')return;assign.mutate({id:program.id,input:{userIds:selected,dueDate:dueDate||null,status:'assigned'}},{onSuccess:()=>setSelected([])});}}>
    <h3 className="font-medium">Assign people</h3>
    {program.status==='archived'&&<p className="text-amber-800">Reactivate this programme before making new assignments.</p>}
    <AccessibleField label="Find a person"><input className="w-full rounded border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></AccessibleField>
    <fieldset disabled={!ready||assign.isPending||program.status!=='active'} className="max-h-48 overflow-y-auto space-y-2"><legend className="sr-only">Select participants</legend>
     {(members.data??[]).filter(m=>m.name.toLowerCase().includes(search.toLowerCase())).map(m=><label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(m.id)||existing.has(m.id)} disabled={existing.has(m.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,m.id]:s.filter(id=>id!==m.id))}/>{m.name}{existing.has(m.id)&&<span className="text-slate-500">Already assigned</span>}</label>)}
    </fieldset>
    <AccessibleField label="Due date (optional)"><input type="date" className="rounded border p-2" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></AccessibleField>
    <p className="text-xs text-slate-500">Existing assignments, due dates and completion records are preserved.</p>
    <button disabled={!ready||assign.isPending||!selected.length||program.status!=='active'} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">{assign.isPending?'Assigning...':`Assign ${selected.length} people`}</button>
   </form></PermissionAction>
   <h3 className="mb-2 font-medium">Assignment records</h3>
   {ready&&!records.data?.length&&<p className="text-sm text-slate-500">No one has been assigned yet.</p>}
   <ul className="divide-y">{(records.data??[]).map(r=><li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{r.userName||r.userEmail||'Organisation member'}</span><span>{TRAINING_RECORD_STATUS_CONFIG[r.status]?.label??r.status}{r.dueDate?` - Due ${r.dueDate.slice(0,10)}`:''}</span></li>)}</ul>
  </section>
 </ModalSurface>;
}
