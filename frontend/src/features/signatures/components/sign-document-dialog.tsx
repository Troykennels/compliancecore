import { humanize } from '@/lib/labels';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCreateSignature } from '../hooks/use-signatures';
import { signaturesApi } from '../api/signatures.api';
import { SignaturePad } from './signature-pad';
import { useAuthStore } from '@/stores/auth.store';

const TYPES = [{type:'policy',label:'Policy',path:'policies'},{type:'control',label:'Control',path:'controls'},{type:'risk',label:'Risk',path:'risks'},{type:'vendor',label:'Vendor',path:'vendors'},{type:'audit',label:'Audit',path:'audits'},{type:'training',label:'Training programme',path:'training'},{type:'evidence',label:'Evidence',path:'evidence'}];
type RecordItem = { id: string; title?: string; name?: string; controlRef?: string };
function normalise(value: unknown): RecordItem[] {
  if (Array.isArray(value)) return value as RecordItem[];
  if (value && typeof value === 'object') { for (const item of Object.values(value)) if (Array.isArray(item)) return item as RecordItem[]; }
  return [];
}
export function SignDocumentDialog({ onClose }: { onClose: () => void }) {
  const [type,setType]=useState('policy'),[id,setId]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1);
  const [ack,setAck]=useState(false),[draw,setDraw]=useState(false),[image,setImage]=useState<string>();
  const tenant=useAuthStore(state=>state.activeTenant),sign=useCreateSignature();
  const source=TYPES.find(item=>item.type===type)!;
  const available=TYPES.filter(item=>!['control_owner','msp_admin'].includes(tenant?.role||'')||['policy','control','risk','evidence'].includes(item.type));
  const list=useQuery({queryKey:['signature-picker',tenant?.id,type,page,search],queryFn:async()=>normalise((await apiClient.get<{data:unknown}>(`/${source.path}`,{params:{page,limit:20,search:search||undefined,q:search||undefined}})).data.data)});
  const preview=useQuery({queryKey:['signature-preview',tenant?.id,type,id],queryFn:async()=>(await signaturesApi.preview(type,id)).data.data,enabled:!!id});
  const completedEvidence = type!=='evidence'||!!preview.data?.fields.find(field=>field.name==='file_checksum'&&typeof field.value==='string'&&field.value.length===64);
  const ready=!!preview.data&&!preview.isFetching&&ack&&(!draw||!!image)&&completedEvidence&&!sign.isPending;
  function resetReview(){setId('');setAck(false);setDraw(false);setImage(undefined);}
  return <Dialog.Root open onOpenChange={open=>{if(!open&&!sign.isPending)onClose();}}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content onPointerDownOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{if(sign.isPending)event.preventDefault();}} className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-xl">
    <div className="flex items-start justify-between border-b border-slate-200 p-5"><div><Dialog.Title className="text-lg font-bold">Sign a document</Dialog.Title><Dialog.Description className="mt-1 text-xs text-slate-600">Select a saved record, review its content and confirm your signature.</Dialog.Description></div><Dialog.Close disabled={sign.isPending} aria-label="Close signature form" className="rounded p-2"><X className="h-4 w-4" /></Dialog.Close></div>
    <form className="min-h-0 overflow-y-auto p-5" onSubmit={async event=>{event.preventDefault();if(!ready||!preview.data)return;try{await sign.mutateAsync({documentType:type,documentId:id,documentHash:preview.data.documentHash,...(draw?{signatureImage:image}:{})});onClose();}catch{/* Keep the reviewed form open; the mutation explains the error. */}}}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Document type<select aria-label="Document type" value={type} onChange={event=>{setType(event.target.value);setPage(1);setSearch('');resetReview();}} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">{available.map(item=><option key={item.type} value={item.type}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Search records<input value={search} onChange={event=>{setSearch(event.target.value);setPage(1);resetReview();}} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" placeholder="Search by name or title" /></label></div>
      <label className="mt-4 block text-sm font-medium">Saved record<select aria-label="Saved record" value={id} onChange={event=>{resetReview();setId(event.target.value);}} className="mt-1 block w-full rounded-lg border border-slate-300 p-2"><option value="">Choose a record…</option>{list.data?.map(record=><option key={record.id} value={record.id}>{record.title||record.name||record.controlRef||record.id}</option>)}</select></label>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{list.isLoading?'Loading records…':list.isError?'Could not load records. Check your access and try again.':list.data?.length===0?'No records found. Save a record in the relevant module first.':`Page ${page}`}</span><div className="flex gap-3"><button type="button" disabled={page===1||list.isFetching} onClick={()=>{setPage(value=>value-1);resetReview();}} className="disabled:opacity-40">Previous</button><button type="button" disabled={list.isFetching||(list.data?.length||0)<20} onClick={()=>{setPage(value=>value+1);resetReview();}} className="disabled:opacity-40">Next</button></div></div>
      <a href={`/${source.path}${type==='evidence'&&id?`/${id}`:''}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-indigo-700 underline">Open {source.label.toLowerCase()} module to review the original</a>
      {id&&<section aria-label="Document preview" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">{preview.isLoading?<p className="text-sm">Loading the document preview…</p>:preview.isError?<p className="text-sm text-red-700">Could not load the preview. <button type="button" onClick={()=>preview.refetch()} className="underline">Retry</button></p>:preview.data&&<><h3 className="font-semibold">{preview.data.title}</h3><dl className="mt-3 max-h-64 space-y-3 overflow-y-auto text-xs">{preview.data.fields.filter(field=>!['id','file_checksum'].includes(field.name)).map(field=><div key={field.name}><dt className="font-semibold capitalize text-slate-600">{humanize(field.name)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{field.value===null?'Not recorded':typeof field.value==='object'?JSON.stringify(field.value):String(field.value)}</dd></div>)}</dl><p className="mt-3 break-all font-mono text-[10px] text-slate-500">Document fingerprint: {preview.data.documentHash}</p></>}</section>}
      {!completedEvidence&&id&&preview.data&&<p className="mt-3 text-sm text-amber-800">Complete the evidence file upload before signing.</p>}
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={draw} onChange={event=>{setDraw(event.target.checked);setImage(undefined);}} />Add a drawn signature</label>{draw&&<div className="mt-3"><SignaturePad key={`${type}:${id}`} onChange={setImage} /></div>}
      <label className="mt-4 flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)} className="mt-1" />I have reviewed the selected document and intend to sign this snapshot using my account.</label>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Signing records your identity and the reviewed snapshot. It does not publish a policy or complete an approval request. <Link to="/guide#signatures" onClick={onClose} className="font-medium text-indigo-700 underline">Read the signing guide</Link>.</p>
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={sign.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={!ready} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sign.isPending?'Signing…':'Sign document'}</button></div>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
