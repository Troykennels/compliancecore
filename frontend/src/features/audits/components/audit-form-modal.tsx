import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Audit } from '../types/audits.types';
import { AUDIT_TYPE_CONFIG, AUDIT_STATUS_CONFIG } from '../types/audits.types';
import { useCreateAudit, useUpdateAudit } from '../hooks/use-audits';

const schema = z.object({
  title:        z.string().min(1, 'Title is required').max(500),
  auditType:    z.enum(['internal', 'external', 'certification', 'surveillance']).default('internal'),
  frameworkRef: z.string().max(100).optional(),
  status:       z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  auditorName:  z.string().max(255).optional(),
  scope:        z.string().max(10000).optional(),
  startDate:    z.string().optional(),
  endDate:      z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  audit?: Audit; // if set, editing; otherwise creating
}

const DEFAULTS: FormValues = {
  title:        '',
  auditType:    'internal',
  frameworkRef: '',
  status:       'planned',
  auditorName:  '',
  scope:        '',
  startDate:    '',
  endDate:      '',
};

export function AuditFormModal({ open, onClose, audit }: Props): JSX.Element | null {
  const isEditing = !!audit;
  const { mutate: create, isPending: isCreating } = useCreateAudit();
  const { mutate: update, isPending: isUpdating } = useUpdateAudit();
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
    if (audit) {
      reset({
        title:        audit.title,
        auditType:    audit.auditType,
        frameworkRef: audit.frameworkRef ?? '',
        status:       audit.status,
        auditorName:  audit.auditorName ?? '',
        scope:        audit.scope ?? '',
        startDate:    audit.startDate ? audit.startDate.slice(0, 10) : '',
        endDate:      audit.endDate ? audit.endDate.slice(0, 10) : '',
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, audit, reset]);

  const onSubmit = (values: FormValues) => {
    const input = {
      title:        values.title,
      auditType:    values.auditType,
      frameworkRef: values.frameworkRef || null,
      status:       values.status,
      auditorName:  values.auditorName || null,
      scope:        values.scope || null,
      startDate:    values.startDate ? new Date(values.startDate).toISOString() : null,
      endDate:      values.endDate ? new Date(values.endDate).toISOString() : null,
    };

    if (isEditing) {
      update({ id: audit.id, input }, { onSuccess: onClose });
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
            {isEditing ? 'Edit Audit' : 'New Audit'}
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
                <input
                  {...register('title')}
                  autoFocus
                  placeholder="e.g. SOC 2 Type II Annual Audit"
                  className={inputClass(!!errors.title)}
                />
              </FormField>

              <FormField label="Audit Type" error={errors.auditType?.message}>
                <select {...register('auditType')} className={inputClass(false)}>
                  {Object.entries(AUDIT_TYPE_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputClass(false)}>
                  {Object.entries(AUDIT_STATUS_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Framework Reference" error={errors.frameworkRef?.message}>
                <input
                  {...register('frameworkRef')}
                  placeholder="e.g. ISO 27001"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Auditor Name" error={errors.auditorName?.message}>
                <input
                  {...register('auditorName')}
                  placeholder="e.g. Jane Doe / Acme LLP"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Start Date" error={errors.startDate?.message}>
                <input type="date" {...register('startDate')} className={inputClass(false)} />
              </FormField>

              <FormField label="End Date" error={errors.endDate?.message}>
                <input type="date" {...register('endDate')} className={inputClass(false)} />
              </FormField>

              <FormField label="Scope" error={errors.scope?.message} className="col-span-2">
                <textarea {...register('scope')} rows={3} className={cn(inputClass(false), 'resize-none')} />
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
              {isEditing ? 'Save Changes' : 'Create Audit'}
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
