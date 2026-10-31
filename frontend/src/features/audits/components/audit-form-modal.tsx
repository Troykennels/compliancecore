import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { AccessibleField as Field } from '@/components/accessible-field';
import { ModalSurface } from '@/components/modal-surface';
import { refineDateStrings } from '@/lib/form-validation';
import { useAuthStore } from '@/stores/auth.store';
import { useFrameworks } from '@/features/frameworks/hooks/use-frameworks';
import { useImplementationMembers } from '@/features/frameworks/implementation';
import type { Audit } from '../types/audits.types';
import { AUDIT_TYPE_CONFIG, AUDIT_STATUS_CONFIG } from '../types/audits.types';
import { useCreateAudit, useUpdateAudit } from '../hooks/use-audits';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  auditType: z.enum(['internal', 'external', 'certification', 'surveillance']).default('internal'),
  frameworkRef: z.string().max(100).optional(),
  status: z.enum(['planned', 'in_progress', 'cancelled']).default('planned'),
  auditorName: z.string().trim().max(255).optional(),
  ownerId: z.string().uuid('Choose the responsible person'),
  scope: z.string().trim().max(10000).optional(),
  summary: z.string().trim().max(10000).optional(),
  startDate: z.string().optional(), endDate: z.string().optional(),
}).superRefine(refineDateStrings);
type Values = z.infer<typeof schema>;
const initial: Values = { title: '', auditType: 'internal', frameworkRef: '', status: 'planned', auditorName: '', ownerId: '', scope: '', summary: '', startDate: '', endDate: '' };
const input = 'block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-600';
export function AuditFormModal({ open, onClose, audit }: { open: boolean; onClose: () => void; audit?: Audit }) {
  const userId = useAuthStore(s => s.user?.id);
  const { data: frameworks = [] } = useFrameworks();
  const { data: members = [], isLoading: membersLoading, isError: membersError, refetch: reloadMembers } = useImplementationMembers(open);
  const create = useCreateAudit(), update = useUpdateAudit();
  const pending = create.isPending || update.isPending;
  const { register, reset, handleSubmit, watch, formState: { errors } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: initial });
  useEffect(() => {
    if (open) reset(audit ? { title: audit.title, auditType: audit.auditType, frameworkRef: audit.frameworkRef ?? '', status: audit.status === 'completed' ? 'in_progress' : audit.status, auditorName: audit.auditorName ?? '', ownerId: audit.ownerId ?? userId ?? '', scope: audit.scope ?? '', summary: audit.summary ?? '', startDate: audit.startDate?.slice(0,10) ?? '', endDate: audit.endDate?.slice(0,10) ?? '' } : { ...initial, ownerId: userId ?? '' });
  }, [open, audit, reset, userId]);
  if (!open) return null;
  function submit(v: Values) {
    const data = { ...v, frameworkRef: v.frameworkRef || null, auditorName: v.auditorName || null, scope: v.scope || null, summary: v.summary || null, startDate: v.startDate ? new Date(v.startDate).toISOString() : null, endDate: v.endDate ? new Date(v.endDate).toISOString() : null };
    if (audit) update.mutate({ id: audit.id, input: data }, { onSuccess: onClose });
    else create.mutate(data, { onSuccess: onClose });
  }
  return <ModalSurface label={audit ? 'Edit audit' : 'New audit'} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
    <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-semibold">{audit ? 'Edit audit' : 'New audit'}</h2><button type="button" aria-label="Close audit form" onClick={onClose}><X className="h-5 w-5" /></button></div>
      <form onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-col">
        <div className="space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-slate-600">Save the report details, arrange an independent report review, then use Complete reviewed audit. The reviewer must be a different person from the owner or report preparer.</p>
          {audit?.status === 'completed' && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Saving changes reopens this completed audit and clears its previous report approval. Arrange a fresh review before completing it again.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audit title" error={errors.title?.message} required className="sm:col-span-2"><input {...register('title')} autoFocus className={input} /></Field>
            <Field label="Audit type"><select {...register('auditType')} className={input}>{Object.entries(AUDIT_TYPE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Work status"><select {...register('status')} className={input}>{Object.entries(AUDIT_STATUS_CONFIG).filter(([k]) => k !== 'completed').map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Framework or requirements"><select {...register('frameworkRef')} className={input}><option value="">General organisational audit</option>{audit?.frameworkRef && !frameworks.some(f => f.id === audit.frameworkRef || f.code === audit.frameworkRef) && <option value={audit.frameworkRef}>{audit.frameworkRef} (existing reference)</option>}{frameworks.map(f => <option key={f.id} value={f.id}>{f.shortName || f.name}</option>)}{audit?.frameworkRef && frameworks.some(f => f.code === audit.frameworkRef) && <option value={audit.frameworkRef}>{audit.frameworkRef} (existing reference)</option>}</select></Field>
            <Field label="Responsible audit owner" required error={errors.ownerId?.message}><select {...register('ownerId')} value={watch('ownerId')} disabled={membersLoading||membersError} className={input}><option value="">{membersLoading?'Loading people...':'Choose a person'}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            {membersError&&<p role="alert" className="text-sm text-red-700 sm:col-span-2">The people list could not be loaded. <button type="button" className="underline" onClick={()=>void reloadMembers()}>Try again</button></p>}
            <Field label="Auditor name or firm" className="sm:col-span-2"><input {...register('auditorName')} className={input} /></Field>
            <Field label="Start date" error={errors.startDate?.message}><input type="date" {...register('startDate')} className={input} /></Field>
            <Field label="End date" error={errors.endDate?.message}><input type="date" {...register('endDate')} className={input} /></Field>
            <Field label="Audit scope" className="sm:col-span-2"><textarea {...register('scope')} rows={3} className={input} /></Field>
            <Field label="Report summary and conclusion" error={errors.summary?.message} className="sm:col-span-2"><textarea {...register('summary')} rows={4} className={input} placeholder="Summarise the work performed, key findings and conclusion. Attach the final report in the report-review workflow." /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-5 py-4"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={pending||membersLoading||membersError} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{audit ? 'Save report details' : 'Create audit'}</button></div>
      </form>
    </div>
  </ModalSurface>;
}
