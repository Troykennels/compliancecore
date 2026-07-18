import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingProgram } from '../types/training.types';
import { TRAINING_STATUS_CONFIG } from '../types/training.types';
import { useCreateTraining, useUpdateTraining } from '../hooks/use-training';

const schema = z.object({
  title:           z.string().min(1, 'Title is required').max(500),
  description:     z.string().max(10000).optional(),
  category:        z.string().max(100).optional(),
  provider:        z.string().max(255).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1000000).optional(),
  isMandatory:     z.boolean().default(false),
  frequencyDays:   z.coerce.number().int().min(1).max(3650).optional(),
  status:          z.enum(['active', 'archived']).default('active'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  program?: TrainingProgram; // if set, editing; otherwise creating
}

const DEFAULTS: FormValues = {
  title:           '',
  description:     '',
  category:        '',
  provider:        '',
  durationMinutes: undefined,
  isMandatory:     false,
  frequencyDays:   undefined,
  status:          'active',
};

export function TrainingFormModal({ open, onClose, program }: Props): JSX.Element | null {
  const isEditing = !!program;
  const { mutate: create, isPending: isCreating } = useCreateTraining();
  const { mutate: update, isPending: isUpdating } = useUpdateTraining();
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
    if (program) {
      reset({
        title:           program.title,
        description:     program.description ?? '',
        category:        program.category ?? '',
        provider:        program.provider ?? '',
        durationMinutes: program.durationMinutes ?? undefined,
        isMandatory:     program.isMandatory,
        frequencyDays:   program.frequencyDays ?? undefined,
        status:          program.status,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, program, reset]);

  const onSubmit = (values: FormValues) => {
    const input = {
      title:           values.title,
      description:     values.description || null,
      category:        values.category || null,
      provider:        values.provider || null,
      durationMinutes: values.durationMinutes ?? null,
      isMandatory:     values.isMandatory,
      frequencyDays:   values.frequencyDays ?? null,
      status:          values.status,
    };

    if (isEditing) {
      update({ id: program.id, input }, { onSuccess: onClose });
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
            {isEditing ? 'Edit Training Program' : 'New Training Program'}
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
              <FormField label="Title" error={errors.title?.message} required className="col-span-2">
                <input {...register('title')} autoFocus className={inputClass(!!errors.title)} />
              </FormField>

              <FormField label="Description" error={errors.description?.message} className="col-span-2">
                <textarea {...register('description')} rows={3} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Category" error={errors.category?.message}>
                <input
                  {...register('category')}
                  placeholder="e.g. Security Awareness"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Provider" error={errors.provider?.message}>
                <input
                  {...register('provider')}
                  placeholder="e.g. KnowBe4"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Duration (minutes)" error={errors.durationMinutes?.message}>
                <input type="number" {...register('durationMinutes')} className={inputClass(!!errors.durationMinutes)} />
              </FormField>

              <FormField label="Frequency (days)" error={errors.frequencyDays?.message}>
                <input type="number" {...register('frequencyDays')} className={inputClass(!!errors.frequencyDays)} />
              </FormField>

              <FormField label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputClass(false)}>
                  {Object.entries(TRAINING_STATUS_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <div className="flex items-center gap-2 pt-6">
                <input
                  id="isMandatory"
                  type="checkbox"
                  {...register('isMandatory')}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                <label htmlFor="isMandatory" className="text-sm font-medium text-slate-700">
                  Mandatory
                </label>
              </div>
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
              {isEditing ? 'Save Changes' : 'Create Program'}
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
