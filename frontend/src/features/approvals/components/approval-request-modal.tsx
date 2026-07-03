import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateApprovalRequest, useWorkflows } from '../hooks/use-approvals';

const stepSchema = z.object({
  stepOrder:    z.number().default(1),
  name:         z.string().min(1, 'Step name required'),
  approverType: z.enum(['user','role','manager','any_from_list']).default('user'),
  assignedTo:   z.string().uuid().optional().or(z.literal('')),
  assignedRole: z.string().optional(),
  requireSignature: z.boolean().default(false),
  instructions: z.string().optional(),
  deadlineHours:z.coerce.number().int().positive().optional(),
});

const schema = z.object({
  title:        z.string().min(1, 'Title required').max(500),
  description:  z.string().max(5000).optional(),
  entityType:   z.string().min(1).default('general'),
  entityId:     z.string().uuid().optional().or(z.literal('')),
  priority:     z.enum(['critical','high','medium','low']).default('medium'),
  deadline:     z.string().optional(),
  workflowId:   z.string().uuid().optional().or(z.literal('')),
  useWorkflow:  z.boolean().default(false),
  steps:        z.array(stepSchema).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ApprovalRequestModalProps {
  open:     boolean;
  onClose:  () => void;
  entityType?: string;
  entityId?:   string;
  entityTitle?:string;
}

export function ApprovalRequestModal({ open, onClose, entityType, entityId, entityTitle }: ApprovalRequestModalProps) {
  const create = useCreateApprovalRequest();
  const { data: workflows = [] } = useWorkflows();

  const { register, control, watch, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityType: entityType ?? 'general',
      entityId:   entityId ?? '',
      priority:   'medium',
      useWorkflow: false,
      steps: [{ stepOrder: 1, name: 'Review & Approve', approverType: 'user', requireSignature: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });

  const useWorkflow = watch('useWorkflow');

  const onSubmit = async (values: FormValues) => {
    const dto: any = {
      title:       values.title,
      description: values.description || undefined,
      entityType:  values.entityType,
      entityId:    values.entityId || undefined,
      priority:    values.priority,
      deadline:    values.deadline ? new Date(values.deadline).toISOString() : undefined,
    };

    if (values.useWorkflow && values.workflowId) {
      dto.workflowId = values.workflowId;
    } else {
      dto.steps = (values.steps ?? []).map((s, i) => ({
        ...s,
        stepOrder: i + 1,
        assignedTo:   s.assignedTo || undefined,
        assignedRole: s.assignedRole || undefined,
      }));
    }

    await create.mutateAsync(dto);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Approval Request</h2>
            {entityTitle && <p className="text-xs text-slate-500 mt-0.5">for: {entityTitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Title *</label>
              <input {...register('title')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              {errors.title && <p className="mt-0.5 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Priority</label>
                <select {...register('priority')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Deadline</label>
                <input type="datetime-local" {...register('deadline')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
              <textarea {...register('description')} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500" />
            </div>

            {/* Workflow vs Ad-hoc */}
            {workflows.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mb-2">
                  <input type="checkbox" {...register('useWorkflow')} className="h-4 w-4 rounded border-slate-300" />
                  Use a workflow template
                </label>
                {useWorkflow && (
                  <select {...register('workflowId')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select workflow…</option>
                    {workflows.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Ad-hoc steps */}
            {!useWorkflow && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-700">Approval Steps *</label>
                  <button
                    type="button"
                    onClick={() => append({ stepOrder: fields.length + 1, name: '', approverType: 'user', requireSignature: false })}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Step {idx + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        {...register(`steps.${idx}.name`)}
                        placeholder="Step name"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select {...register(`steps.${idx}.approverType`)} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white">
                          <option value="user">Specific user</option>
                          <option value="role">Role</option>
                          <option value="manager">Manager</option>
                        </select>
                        <input
                          {...register(`steps.${idx}.assignedTo`)}
                          placeholder="Approver ID (UUID)"
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" {...register(`steps.${idx}.requireSignature`)} className="h-3.5 w-3.5 rounded border-slate-300" />
                        Require digital signature
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={create.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {create.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
