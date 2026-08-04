import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useCreateTask, useUpdateTask } from '../hooks/use-tasks';
import type { Task } from '../types/tasks.types';

const schema = z.object({
  title:       z.string().min(1, 'Title required').max(500),
  description: z.string().max(10000).optional(),
  // Must match TaskStatus and the API's own enum, including 'blocked' — the
  // board has a Blocked column, so its "+" button posted a status this schema
  // rejected.
  status:      z.enum(['todo','in_progress','in_review','completed','cancelled','blocked']).default('todo'),
  priority:    z.enum(['critical','high','medium','low']).default('medium'),
  assignedTo:  z.string().uuid().optional().or(z.literal('')),
  dueDate:     z.string().optional(),
  entityType:  z.string().optional(),
  entityId:    z.string().uuid().optional().or(z.literal('')),
  tags:        z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface TaskFormModalProps {
  open:          boolean;
  onClose:       () => void;
  task?:         Task;
  parentTaskId?: string;
  entityType?:   string;
  entityId?:     string;
  defaultStatus?: FormValues['status'];
}

export function TaskFormModal({ open, onClose, task, parentTaskId, entityType, entityId, defaultStatus }: TaskFormModalProps) {
  const isEdit = Boolean(task);
  const create = useCreateTask();
  const update = useUpdateTask(task?.id ?? '');

  const { register, watch, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:       '',
      status:      'todo',
      priority:    'medium',
      isRecurring: false,
      entityType:  entityType ?? '',
      entityId:    entityId ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      if (task) {
        reset({
          title:          task.title,
          description:    task.description ?? '',
          status:         task.status,
          priority:       task.priority,
          assignedTo:     task.assignedTo ?? '',
          dueDate:        task.dueDate ? task.dueDate.slice(0, 16) : '',
          entityType:     task.entityType ?? '',
          entityId:       task.entityId ?? '',
          tags:           task.tags.join(', '),
          isRecurring:    task.isRecurring,
          recurrenceRule: task.recurrenceRule ?? '',
        });
      } else {
        reset({ title: '', status: defaultStatus ?? 'todo', priority: 'medium', isRecurring: false, entityType: entityType ?? '', entityId: entityId ?? '' });
      }
    }
  }, [open, task, reset, entityType, entityId, defaultStatus]);

  const isRecurring = watch('isRecurring');

  const onSubmit = async (values: FormValues) => {
    const dto = {
      title:          values.title,
      description:    values.description || undefined,
      status:         values.status,
      priority:       values.priority,
      assignedTo:     values.assignedTo || undefined,
      dueDate:        values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      entityType:     values.entityType || undefined,
      entityId:       values.entityId || undefined,
      tags:           values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      isRecurring:    values.isRecurring,
      recurrenceRule: values.recurrenceRule || undefined,
      ...(parentTaskId && { parentTaskId }),
    };

    if (isEdit) {
      await update.mutateAsync(dto);
    } else {
      await create.mutateAsync(dto);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? 'Edit Task' : parentTaskId ? 'Add Subtask' : 'New Task'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Title *</label>
              <input {...register('title')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              {errors.title && <p className="mt-0.5 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select {...register('status')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Priority</label>
                <select {...register('priority')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Assigned To (UUID)</label>
                <input {...register('assignedTo')} placeholder="User UUID" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Due Date</label>
                <input type="datetime-local" {...register('dueDate')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Tags (comma-separated)</label>
              <input {...register('tags')} placeholder="e.g. security, audit, q4" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" {...register('isRecurring')} className="h-4 w-4 rounded border-slate-300" />
              Recurring task
            </label>

            {isRecurring && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Recurrence Rule (iCal RRULE)</label>
                <input {...register('recurrenceRule')} placeholder="FREQ=WEEKLY;BYDAY=MO" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {(create.isPending || update.isPending) ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
