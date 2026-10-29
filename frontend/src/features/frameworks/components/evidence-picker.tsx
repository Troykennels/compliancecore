import { ModalSurface } from '@/components/modal-surface';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { evidenceApi } from '@/features/evidence/api/evidence.api';
import { EvidenceUploadModal } from '@/features/evidence/components/evidence-upload-modal';
import { AssessmentField as Field, assessmentInput as input, assessmentButton as button, assessmentSecondary as secondary } from './assessment-records';
export function EvidencePicker({controlId,close,done}:{controlId:string;close:()=>void;done:()=>void}) {
 const [search,setSearch]=useState('');
 const {data,isLoading,isError}=useQuery({queryKey:['implementation-evidence-picker',search],queryFn:()=>evidenceApi.list({limit:100,status:'active',q:search||undefined}).then(r=>r.data.data)});
 const [selected,setSelected]=useState('');const [upload,setUpload]=useState(false);const [busy,setBusy]=useState(false);
 const link=async(id:string)=>{setBusy(true);try{await evidenceApi.addLink(id,{linkedType:'control',linkedId:controlId});toast.success('Evidence attached to this control.');done();}catch{toast.error('Could not link the file. The uploaded record is retained in Evidence.');}finally{setBusy(false);}};
 return <ModalSurface label="Show proof of this safeguard" onClose={close} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5"><h3 className="text-lg font-semibold">Show proof of this safeguard</h3><p className="text-sm text-slate-600">Choose a saved file, or upload a new one. The file will be attached to this control automatically.</p><input aria-label="Find saved evidence" className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title or description"/>{isLoading?<p>Loading saved evidence…</p>:isError?<p className="text-sm text-red-700">Saved evidence could not be loaded. Close and try again.</p>:<Field label="Saved evidence"><select aria-label="Saved evidence for this control" className={input} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a file</option>{data?.evidence.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>}<div className="flex flex-wrap gap-2"><button disabled={!selected||busy} className={button} onClick={()=>void link(selected)}>Attach selected file</button><button className={secondary} onClick={()=>setUpload(true)}>Upload a new file</button><button className={secondary} onClick={close}>Close</button></div>{upload&&<EvidenceUploadModal open onClose={()=>setUpload(false)} onSuccess={id=>void link(id)}/>}</div></ModalSurface>;
}
