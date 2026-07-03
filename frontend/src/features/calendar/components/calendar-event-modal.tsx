import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '../hooks/use-calendar';
import type { CalendarEvent, CalendarEventType, CalendarEventPriority } from '../types/calendar.types';
import { EVENT_TYPE_LABELS } from '../types/calendar.types';

const schema = z.object({
  title:       z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  eventType:   z.enum(['deadline','review','audit','training','renewal','assessment','meeting','other']).default('other'),
  startDate:   z.string().min(1, 'Start date is required'),
  endDate:     z.string().optional(),
  allDay:      z.boolean().default(false),
  assignedTo:  z.string().uuid().optional().nullable(),
  priority:    z.enum(['critical','high','medium','low']).default('medium'),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  reminderDays: z.string().default('7,1'),
  status:      z.enum(['upcoming','in_progress','completed','cancelled','overdue']).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CalendarEventModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
}

const TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS) as [CalendarEventType, string][];
const PRIORITY_COLORS: Record<CalendarEventPriority, string> = {
  critical: 'text-red-600', high: 'text-orange-600', medium: 'text-blue-600', low: 'text-slate-500',
};

function toDatetimeLocal(iso: string) {
  return iso ? iso.slice(0, 16) : '';
}

export function CalendarEventModal({ open, onClose, event, defaultDate }: CalendarEventModalProps) {
  const create = useCreateCalendarEvent();
  const update = useUpdateCalendarEvent(event?.id ?? '');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      if (event) {
        reset({
          title:       event.title,
          description: event.description ?? '',
          eventType:   event.eventType,
          startDate:   toDatetimeLocal(event.startDate),
          endDate:     event.endDate ? toDatetimeLocal(event.endDate) : '',
          allDay:      event.allDay,
          assignedTo:  event.assignedTo ?? undefined,
          priority:    event.priority,
          color:       event.color,
          reminderDays: (event.reminderDays ?? [7, 1]).join(','),
          status:      event.status,
        });
      } else {
        reset({
          title: '', description: '', eventType: 'other',
          startDate: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : '',
          endDate: '', allDay: false, priority: 'medium',
          color: '#3B82F6', reminderDays: '7,1',
        });
      }
    }
  }, [open, event, defaultDate, reset]);

  const isSubmitting = create.isPending || update.isPending;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title:        values.title,
      description:  values.description || null,
      eventType:    values.eventType as CalendarEventType,
      startDate:    new Date(values.startDate).toISOString(),
      endDate:      values.endDate ? new Date(values.endDate).toISOString() : null,
      allDay:       values.allDay,
      assignedTo:   values.assignedTo || null,
      priority:     values.priority as CalendarEventPriority,
      color:        values.color,
      reminderDays: values.reminderDays.split(',').map((d) => parseInt(d.trim(), 10)).filter(Boolean),
      status:       values.status,
    };

    if (event) {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {event ? 'Edit Event' : 'New Calendar Event'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
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
                <label className="mb-1 block text-xs font-medium text-slate-700">Event Type</label>
                <select {...register('eventType')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Priority</label>
                <select {...register('priority')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {(['critical','high','medium','low'] as const).map((p) => (
                    <option key={p} value={p} className={PRIORITY_COLORS[p]}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Start Date *</label>
                <input type="datetime-local" {...register('startDate')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                <input type="datetime-local" {...register('endDate')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Color</label>
                <div className="flex items-center gap-2">
                  <Controller name="color" control={control} render={({ field }) => (
                    <input type="color" value={field.value} onChange={field.onChange} className="h-9 w-16 rounded border border-slate-300 p-0.5 cursor-pointer" />
                  )} />
                  <span className="text-xs text-slate-500">Event colour</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Remind (days before)</label>
                <input {...register('reminderDays')} placeholder="7,3,1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                <p className="mt-0.5 text-xs text-slate-400">Comma-separated</p>
              </div>
            </div>

            {event && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select {...register('status')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            <Controller name="allDay" control={control} render={({ field }) => (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-slate-300" />
                All-day event
              </label>
            )} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : event ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
