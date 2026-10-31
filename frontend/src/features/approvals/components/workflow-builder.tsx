import { AccessibleField } from '@/components/accessible-field';
import { ModalSurface } from '@/components/modal-surface';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useCreateWorkflow } from '../hooks/use-approvals';

const stepSchema = z.object({
  stepOrder:        z.number().default(1),
  name:             z.string().min(1, 'Step name required'),
  instructions:     z.string().max(2000).optional(),
  approverType:     z.enum(['user','role','manager','any_from_list']).default('role'),
  assignedTo:       z.string().optional(),
  assignedRole:     z.string().optional(),
  minApprovals:     z.coerce.number().int().min(1).default(1),
  deadlineHours:    z.coerce.number().int().positive().optional(),
  allowSelfApproval: z.boolean().default(false),
  requireSignature:  z.boolean().default(false),
});

const schema = z.object({
  name:        z.string().min(1, 'Workflow name required').max(255),
  description: z.string().max(2000).optional(),
  entityType:  z.string().optional(),
  steps:       z.array(stepSchema).min(1, 'At least one step is required'),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  'admin', 'compliance_manager', 'control_owner', 'auditor',
  'owner', 'msp_admin', 'msp_analyst', 'viewer',
];

const ENTITY_TYPE_OPTIONS = [
  'general', 'control', 'evidence', 'risk', 'policy',
  'vendor', 'audit', 'task', 'report',
];

interface WorkflowBuilderProps {
  open:    boolean;
  onClose: () => void;
}

export function WorkflowBuilder({ open, onClose }: WorkflowBuilderProps) {
  const create = useCreateWorkflow();

  const { register, control, watch, handleSubmit, reset, formState: { errors } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityType: 'general',
      steps: [{
        stepOrder: 1,
        name: 'Initial Review',
        approverType: 'role',
        assignedRole: 'compliance_manager',
        minApprovals: 1,
        allowSelfApproval: false,
        requireSignature: false,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });

  const onSubmit = async (values: FormValues) => {
    const dto = {
      name:        values.name,
      description: values.description || undefined,
      entityType:  values.entityType || undefined,
      steps: values.steps.map((s, i) => ({
        stepOrder:         i + 1,
        name:              s.name,
        instructions:      s.instructions || undefined,
        approverType:      s.approverType,
        assignedTo:        s.assignedTo   || undefined,
        assignedRole:      s.assignedRole || undefined,
        minApprovals:      s.minApprovals,
        deadlineHours:     s.deadlineHours || undefined,
        allowSelfApproval: s.allowSelfApproval,
        requireSignature:  s.requireSignature,
      })),
    };
    await create.mutateAsync(dto);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <ModalSurface label="New Workflow Template" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Workflow Template</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define reusable multi-step approval workflows</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close dialog"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Workflow metadata */}
            <div className="grid grid-cols-2 gap-3">
              <AccessibleField label={<>Workflow Name *</>} className="col-span-2">

                <input {...register('name')} placeholder="e.g. Policy Approval — Two-Level" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name.message}</p>}
              </AccessibleField>
              <AccessibleField label={<>Applies To</>} >

                <select {...register('entityType')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {ENTITY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </AccessibleField>
              <AccessibleField label={<>Description</>} >

                <input {...register('description')} placeholder="Optional description" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </AccessibleField>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Workflow Steps</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Steps with the same order number run in parallel</p>
                </div>
                <button
                  type="button"
                  onClick={() => append({
                    stepOrder: fields.length + 1,
                    name: '',
                    approverType: 'role',
                    assignedRole: 'compliance_manager',
                    minApprovals: 1,
                    allowSelfApproval: false,
                    requireSignature: false,
                  })}
                  className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Step
                </button>
              </div>

              {errors.steps?.root && (
                <p className="mb-2 text-xs text-red-600">{errors.steps.root.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const approverType = watch(`steps.${idx}.approverType`);

                  return (
                    <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      {/* Step header */}
                      <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 border-b border-slate-200">
                        <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                        <span className="text-xs font-bold text-slate-600 flex-1">Step {idx + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(idx)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        <AccessibleField label={<>Step Name *</>} >

                          <input
                            {...register(`steps.${idx}.name`)}
                            placeholder="e.g. Manager Review"
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white outline-none focus:border-blue-500"
                          />
                        </AccessibleField>

                        <div className="grid grid-cols-2 gap-3">
                          <AccessibleField label={<>Approver Type</>} >

                            <select {...register(`steps.${idx}.approverType`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white">
                              <option value="user">Specific User</option>
                              <option value="role">By Role</option>
                              <option value="manager">Requester's Manager</option>
                            </select>
                          </AccessibleField>

                          {approverType === 'role' && (
                            <AccessibleField label={<>Role</>} >

                              <select {...register(`steps.${idx}.assignedRole`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white">
                                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </AccessibleField>
                          )}

                          {approverType === 'user' && (
                            <AccessibleField label={<>User ID (UUID)</>} >

                              <input {...register(`steps.${idx}.assignedTo`)} placeholder="User UUID" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white outline-none" />
                            </AccessibleField>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <AccessibleField label={<>Min Approvals</>} >

                            <input type="number" min={1} {...register(`steps.${idx}.minApprovals`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white" />
                          </AccessibleField>
                          <AccessibleField label={<>Deadline (hours)</>} >

                            <input type="number" min={1} placeholder="Optional" {...register(`steps.${idx}.deadlineHours`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white" />
                          </AccessibleField>
                        </div>

                        <AccessibleField label={<>Instructions (shown to approver)</>} >

                          <input {...register(`steps.${idx}.instructions`)} placeholder="Optional guidance for the approver" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white outline-none" />
                        </AccessibleField>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" {...register(`steps.${idx}.requireSignature`)} className="h-3.5 w-3.5 rounded border-slate-300" />
                            Require digital signature
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" {...register(`steps.${idx}.allowSelfApproval`)} className="h-3.5 w-3.5 rounded border-slate-300" />
                            Allow self-approval
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={create.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {create.isPending ? 'Saving...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </ModalSurface>
  );
}
