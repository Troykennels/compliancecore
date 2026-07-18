import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Control } from '../types/controls.types';
import { CRITICALITY_CONFIG, IMPLEMENTATION_STATUS_CONFIG } from '../types/controls.types';
import { useCreateControl, useUpdateControl } from '../hooks/use-controls';

const schema = z.object({
  controlRef:           z.string().min(1, 'Control reference is required').max(100),
  title:                z.string().min(1, 'Title is required').max(500),
  description:          z.string().max(10000).optional(),
  category:             z.string().max(255).optional(),
  criticality:          z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  implementationStatus: z.enum([
    'implemented',
    'partially_implemented',
    'not_implemented',
    'not_applicable',
    'planned',
  ]).default('not_implemented'),
  implementationNotes:  z.string().max(10000).optional(),
  testingNotes:         z.string().max(10000).optional(),
  dueDate:              z.string().optional(),
  reviewFrequencyDays:  z.coerce.number().int().min(1).max(3650).default(365),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  control?: Control; // if set, editing; otherwise creating
}

const DEFAULTS: FormValues = {
  controlRef:           '',
  title:                '',
  description:          '',
  category:             '',
  criticality:          'medium',
  implementationStatus: 'not_implemented',
  implementationNotes:  '',
  testingNotes:         '',
  dueDate:              '',
  reviewFrequencyDays:  365,
};

export function ControlFormModal({ open, onClose, control }: Props): JSX.Element | null {
  const isEditing = !!control;
  const { mutate: create, isPending: isCreating } = useCreateControl();
  const { mutate: update, isPending: isUpdating } = useUpdateControl();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (control) {
      reset({
        controlRef:           control.controlRef,
        title:                control.title,
        description:          control.description ?? '',
        category:             control.category ?? '',
        criticality:          control.criticality,
        implementationStatus: control.implementationStatus,
        implementationNotes:  control.implementationNotes ?? '',
        testingNotes:         control.testingNotes ?? '',
        dueDate:              control.dueDate ? control.dueDate.slice(0, 10) : '',
        reviewFrequencyDays:  control.reviewFrequencyDays,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, control, reset]);

  const onSubmit = (values: FormValues) => {
    const input = {
      controlRef:           values.controlRef,
      title:                values.title,
      description:          values.description || null,
      category:             values.category || null,
      criticality:          values.criticality,
      implementationStatus: values.implementationStatus,
      implementationNotes:  values.implementationNotes || null,
      testingNotes:         values.testingNotes || null,
      dueDate:              values.dueDate ? new Date(values.dueDate).toISOString() : null,
      reviewFrequencyDays:  values.reviewFrequencyDays,
    };

    if (isEditing) {
      update({ id: control.id, input }, { onSuccess: onClose });
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
            {isEditing ? 'Edit Control' : 'New Control'}
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
              <FormField label="Control Reference" error={errors.controlRef?.message} required>
                <input
                  {...register('controlRef')}
                  autoFocus
                  placeholder="e.g. AC-1"
                  className={inputClass(!!errors.controlRef)}
                />
              </FormField>

              <FormField label="Category" error={errors.category?.message}>
                <input
                  {...register('category')}
                  placeholder="e.g. Access Control"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Title" error={errors.title?.message} required className="col-span-2">
                <input {...register('title')} className={inputClass(!!errors.title)} />
              </FormField>

              <FormField label="Description" error={errors.description?.message} className="col-span-2">
                <textarea {...register('description')} rows={3} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Criticality" error={errors.criticality?.message}>
                <select {...register('criticality')} className={inputClass(false)}>
                  {Object.entries(CRITICALITY_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Implementation Status" error={errors.implementationStatus?.message}>
                <select {...register('implementationStatus')} className={inputClass(false)}>
                  {Object.entries(IMPLEMENTATION_STATUS_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Due Date" error={errors.dueDate?.message}>
                <input type="date" {...register('dueDate')} className={inputClass(false)} />
              </FormField>

              <FormField label="Review Frequency (days)" error={errors.reviewFrequencyDays?.message}>
                <input
                  type="number"
                  {...register('reviewFrequencyDays')}
                  className={inputClass(!!errors.reviewFrequencyDays)}
                />
              </FormField>

              <FormField label="Implementation Notes" error={errors.implementationNotes?.message} className="col-span-2">
                <textarea {...register('implementationNotes')} rows={2} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Testing Notes" error={errors.testingNotes?.message} className="col-span-2">
                <textarea {...register('testingNotes')} rows={2} className={cn(inputClass(false), 'resize-none')} />
              </FormField>
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
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Control'}
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
