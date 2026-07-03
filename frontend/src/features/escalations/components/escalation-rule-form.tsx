import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateEscalationRule } from '../hooks/use-escalations';

const chainStepSchema = z.object({
  delayHours:  z.coerce.number().int().min(0).default(24),
  action:      z.enum(['notify','notify_role','reassign','create_task']).default('notify'),
  targetType:  z.enum(['user','role']).optional(),
  targetId:    z.string().optional(),
  targetRole:  z.string().optional(),
  message:     z.string().max(2000).optional(),
});

const schema = z.object({
  name:        z.string().min(1, 'Name required').max(255),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(['task_overdue','approval_pending','expiry_approaching','control_overdue']),
  conditions:  z.object({
    overdueHours:  z.coerce.number().int().min(0).optional(),
    pendingHours:  z.coerce.number().int().min(0).optional(),
    expiryDays:    z.coerce.number().int().min(0).optional(),
    entityType:    z.string().optional(),
    priority:      z.string().optional(),
  }),
  escalationChain: z.array(chainStepSchema).min(1, 'At least one chain step required'),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = ['admin','compliance_manager','control_owner','auditor','owner','msp_admin','msp_analyst'];

interface EscalationRuleFormProps {
  open:    boolean;
  onClose: () => void;
}

export function EscalationRuleForm({ open, onClose }: EscalationRuleFormProps) {
  const create = useCreateEscalationRule();

  const { register, watch, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      triggerType: 'task_overdue',
      conditions: { overdueHours: 24 },
      escalationChain: [{
        delayHours: 0,
        action: 'notify',
        targetType: 'role',
        targetRole: 'compliance_manager',
        message: '',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'escalationChain' });
  const triggerType = watch('triggerType');

  const onSubmit = async (values: FormValues) => {
    await create.mutateAsync({
      name:            values.name,
      description:     values.description || undefined,
      triggerType:     values.triggerType,
      conditions:      values.conditions,
      escalationChain: values.escalationChain.map((s) => ({
        delayHours:  s.delayHours,
        action:      s.action,
        targetType:  s.targetType || undefined,
        targetId:    s.targetId || undefined,
        targetRole:  s.targetRole || undefined,
        message:     s.message || undefined,
      })),
    });
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Escalation Rule</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define triggers and a chain of escalation actions</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Rule Name *</label>
                <input {...register('name')} placeholder="e.g. Escalate Overdue Critical Tasks" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
                <input {...register('description')} placeholder="Optional" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Trigger Type *</label>
                <select {...register('triggerType')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="task_overdue">Task Overdue</option>
                  <option value="approval_pending">Approval Pending</option>
                  <option value="expiry_approaching">Expiry Approaching</option>
                  <option value="control_overdue">Control Review Overdue</option>
                </select>
              </div>
            </div>

            {/* Conditions */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-xs font-semibold text-slate-700 mb-3">Trigger Conditions</h3>
              <div className="grid grid-cols-2 gap-3">
                {(triggerType === 'task_overdue' || triggerType === 'control_overdue') && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Overdue After (hours)</label>
                    <input type="number" min={1} {...register('conditions.overdueHours')} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white" />
                  </div>
                )}
                {triggerType === 'approval_pending' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Pending After (hours)</label>
                    <input type="number" min={1} {...register('conditions.pendingHours')} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white" />
                  </div>
                )}
                {triggerType === 'expiry_approaching' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Days Before Expiry</label>
                    <input type="number" min={1} {...register('conditions.expiryDays')} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white" />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Entity Type (optional)</label>
                  <input {...register('conditions.entityType')} placeholder="e.g. control" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Priority Filter (optional)</label>
                  <select {...register('conditions.priority')} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white">
                    <option value="">Any priority</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Escalation chain */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Escalation Chain</h3>
                  <p className="text-[11px] text-slate-500">Steps execute in sequence based on delay from trigger</p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ delayHours: 24, action: 'notify', targetType: 'role', targetRole: 'admin', message: '' })}
                  className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Step
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const action = watch(`escalationChain.${idx}.action`);
                  return (
                    <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Step {idx + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(idx)} className="text-xs text-red-500 flex items-center gap-1 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Delay After Trigger (hours)</label>
                            <input type="number" min={0} {...register(`escalationChain.${idx}.delayHours`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Action</label>
                            <select {...register(`escalationChain.${idx}.action`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white">
                              <option value="notify">Notify User</option>
                              <option value="notify_role">Notify Role</option>
                              <option value="reassign">Reassign</option>
                              <option value="create_task">Create Task</option>
                            </select>
                          </div>
                        </div>

                        {(action === 'notify' || action === 'reassign') && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Target User ID (UUID)</label>
                            <input {...register(`escalationChain.${idx}.targetId`)} placeholder="User UUID" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white outline-none" />
                          </div>
                        )}

                        {action === 'notify_role' && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Target Role</label>
                            <select {...register(`escalationChain.${idx}.targetRole`)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white">
                              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Message (optional)</label>
                          <input {...register(`escalationChain.${idx}.message`)} placeholder="Custom notification message" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white outline-none" />
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
              {create.isPending ? 'Saving…' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
