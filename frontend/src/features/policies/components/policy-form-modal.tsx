import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Policy } from '../types/policies.types';
import { DOCUMENT_TYPE_CONFIG, POLICY_STATUS_CONFIG } from '../types/policies.types';
import { useCreatePolicy, useUpdatePolicy } from '../hooks/use-policies';
import { useImplementationMembers } from '@/features/frameworks/implementation';
import { useFrameworks } from '@/features/frameworks/hooks/use-frameworks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import { useAuthStore } from '@/stores/auth.store';
import { usePolicyTemplates, type PolicyTemplate } from '../policy-templates';

const schema = z.object({
  title:         z.string().min(1, 'Title is required').max(500),
  ownerId:       z.string().optional(),
  frameworkIds:  z.array(z.string()).default([]),
  description:   z.string().max(5000).optional(),
  documentType:  z.enum(['policy', 'procedure', 'standard', 'guideline']).default('policy'),
  status:        z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).default('draft'),
  content:       z.string().max(100000).optional(),
  reviewDueDate: z.string().optional(),
  tags:          z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  policy?: Policy; // if set, editing; otherwise creating
  initialFrameworkId?: string;
  initialTemplate?: PolicyTemplate;
}

const DEFAULTS: FormValues = {
  title:         '',
  ownerId:       '',
  frameworkIds:  [],
  description:   '',
  documentType:  'policy',
  status:        'draft',
  content:       '',
  reviewDueDate: '',
  tags:          '',
};

export function PolicyFormModal({ open, onClose, policy, initialFrameworkId, initialTemplate }: Props): JSX.Element | null {
  const {data:templates=[]}=usePolicyTemplates();
  const role=useAuthStore(s=>s.activeTenant?.role);
  const canWrite=['owner','admin','compliance_manager','msp_admin'].includes(role??'');
  const {data:members=[]}=useImplementationMembers(open);
  const {data:frameworks=[]}=useFrameworks();
  const {data:versions=[]}=useQuery({queryKey:['policies',policy?.id,'versions'],queryFn:()=>apiClient.get<ApiResponse<Array<{version_number:number;content:string|null;change_note:string|null;created_at:string}>>>(`/policies/${policy!.id}/versions`).then(r=>r.data.data),enabled:open&&Boolean(policy?.id)});
  const isEditing = !!policy;
  const { mutate: create, isPending: isCreating } = useCreatePolicy();
  const { mutate: update, isPending: isUpdating } = useUpdatePolicy();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (policy) {
      reset({
        title:         policy.title,
        ownerId:       policy.ownerId ?? '',
        frameworkIds:  policy.frameworkIds,
        description:   policy.description ?? '',
        documentType:  policy.documentType,
        status:        ['approved','published'].includes(policy.status) ? 'draft' : policy.status,
        content:       policy.content ?? '',
        reviewDueDate: policy.reviewDueDate ? policy.reviewDueDate.slice(0, 10) : '',
        tags:          policy.tags.join(', '),
      });
    } else {
      reset({...DEFAULTS,frameworkIds:initialFrameworkId?[initialFrameworkId]:[],title:initialTemplate?.title??'',content:initialTemplate?.content??'',description:initialTemplate?.purpose??''});
    }
  }, [open, policy, reset, initialFrameworkId, initialTemplate]);

  const onSubmit = (values: FormValues) => {
    if(!canWrite)return;
    const input = {
      title:         values.title,
      ownerId:       values.ownerId || null,
      frameworkIds:  values.frameworkIds,
      description:   values.description || null,
      documentType:  values.documentType,
      status:        values.status,
      content:       values.content || null,
      reviewDueDate: values.reviewDueDate ? new Date(values.reviewDueDate).toISOString() : null,
      tags:          values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };

    if (isEditing) {
      update({ id: policy.id, input }, { onSuccess: onClose });
    } else {
      create(input, { onSuccess: onClose });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? 'Edit Policy' : 'New Policy'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              {!policy&&<div className="col-span-2 space-y-2 rounded-lg bg-indigo-50 p-3"><label className="block text-sm font-semibold">Start from a policy template<select aria-label="Choose policy template" defaultValue={initialTemplate?.id??''} className={inputClass(false)} onChange={e=>{const t=templates.find(t=>t.id===e.target.value);if(t){setValue('title',t.title,{shouldDirty:true});setValue('content',t.content,{shouldDirty:true});setValue('description',t.purpose,{shouldDirty:true});}}}><option value="">Blank draft</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><p className="text-xs text-indigo-950">Choosing a template replaces the draft title and content. Replace every [placeholder] before review; the app checks this before approval.</p></div>}
              <FormField label="Title" error={errors.title?.message} required className="col-span-2">
                <input {...register('title')} autoFocus className={inputClass(!!errors.title)} />
              </FormField>

              <FormField label="Description" error={errors.description?.message} className="col-span-2">
                <textarea {...register('description')} rows={3} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Document Type" error={errors.documentType?.message}>
                <select {...register('documentType')} className={inputClass(false)}>
                  {Object.entries(DOCUMENT_TYPE_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputClass(false)}>
                  {Object.entries(POLICY_STATUS_CONFIG).filter(([value])=>!['approved','published'].includes(value) && (isEditing||value==='draft')).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Review Due Date" error={errors.reviewDueDate?.message}>
                <input type="date" {...register('reviewDueDate')} className={inputClass(false)} />
              </FormField>
              <FormField label="Responsible owner"><select aria-label="Policy owner" {...register('ownerId')} className={inputClass(false)}><option value="">Select an active member</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></FormField>
              <FormField label="Linked frameworks"><select multiple aria-label="Policy linked frameworks" {...register('frameworkIds')} className={inputClass(false)}>{frameworks.map(f=><option key={f.id} value={f.id}>{f.shortName||f.name}</option>)}</select></FormField>

              <FormField label="Tags" error={errors.tags?.message}>
                <input
                  {...register('tags')}
                  placeholder="Comma separated"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Content" error={errors.content?.message} className="col-span-2">
                <textarea {...register('content')} rows={6} className={cn(inputClass(false), 'resize-none')} />
              </FormField>
              {policy&&<details className="col-span-2 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Saved policy versions ({versions.length})</summary>{versions.map(v=><details key={v.version_number} className="mt-2 border-t pt-2"><summary className="cursor-pointer text-xs">Version {v.version_number} · {new Date(v.created_at).toLocaleDateString()} · {v.change_note}</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{v.content||'No content recorded.'}</pre></details>)}</details>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canWrite}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, error, required, className, children }: FormFieldProps): JSX.Element {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    'block w-full rounded-md border px-3 py-2 text-sm text-slate-900',
    'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
    hasError ? 'border-rose-500 bg-rose-50' : 'border-slate-300',
  );
}
