import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Risk } from '../types/risks.types';
import {
  CATEGORY_CONFIG,
  TREATMENT_CONFIG,
  STATUS_CONFIG,
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
  scoreSeverity,
} from '../types/risks.types';
import { useCreateRisk, useUpdateRisk } from '../hooks/use-risks';

const schema = z.object({
  title:              z.string().min(1, 'Title is required').max(500),
  description:        z.string().max(10000).optional(),
  category:           z.enum([
    'operational', 'strategic', 'financial', 'compliance',
    'security', 'privacy', 'reputational', 'third_party',
  ]).default('operational'),
  inherentLikelihood: z.coerce.number().int().min(1).max(5).default(3),
  inherentImpact:     z.coerce.number().int().min(1).max(5).default(3),
  treatment:          z.enum(['mitigate', 'accept', 'transfer', 'avoid']).default('mitigate'),
  residualLikelihood: z.coerce.number().int().min(1).max(5).default(3),
  residualImpact:     z.coerce.number().int().min(1).max(5).default(3),
  status:             z.enum([
    'open', 'in_treatment', 'mitigated', 'accepted', 'closed',
  ]).default('open'),
  mitigationPlan:     z.string().max(10000).optional(),
  ownerId:            z.string().uuid('Must be a valid user ID').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  risk?: Risk; // if set, editing; otherwise creating
}

const DEFAULTS: FormValues = {
  title:              '',
  description:        '',
  category:           'operational',
  inherentLikelihood: 3,
  inherentImpact:     3,
  treatment:          'mitigate',
  residualLikelihood: 3,
  residualImpact:     3,
  status:             'open',
  mitigationPlan:     '',
  ownerId:            '',
};

export function RiskFormModal({ open, onClose, risk }: Props): JSX.Element | null {
  const isEditing = !!risk;
  const { mutate: create, isPending: isCreating } = useCreateRisk();
  const { mutate: update, isPending: isUpdating } = useUpdateRisk();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (risk) {
      reset({
        title:              risk.title,
        description:        risk.description ?? '',
        category:           risk.category,
        inherentLikelihood: risk.inherentLikelihood,
        inherentImpact:     risk.inherentImpact,
        treatment:          risk.treatment,
        residualLikelihood: risk.residualLikelihood,
        residualImpact:     risk.residualImpact,
        status:             risk.status,
        mitigationPlan:     risk.mitigationPlan ?? '',
        ownerId:            risk.ownerId ?? '',
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, risk, reset]);

  const inherentPreview = watch('inherentLikelihood') * watch('inherentImpact');
  const residualPreview = watch('residualLikelihood') * watch('residualImpact');

  const onSubmit = (values: FormValues) => {
    const input = {
      title:              values.title,
      description:        values.description || null,
      category:           values.category,
      inherentLikelihood: values.inherentLikelihood,
      inherentImpact:     values.inherentImpact,
      treatment:          values.treatment,
      residualLikelihood: values.residualLikelihood,
      residualImpact:     values.residualImpact,
      status:             values.status,
      mitigationPlan:     values.mitigationPlan || null,
      ownerId:            values.ownerId ? values.ownerId : null,
    };

    if (isEditing) {
      update({ id: risk.id, input }, { onSuccess: onClose });
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
            {isEditing ? 'Edit Risk' : 'New Risk'}
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
                <select {...register('category')} className={inputClass(false)}>
                  {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputClass(false)}>
                  {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              {/* Inherent risk */}
              <div className="col-span-2 mt-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inherent Risk</span>
                <ScoreBadge score={inherentPreview} />
              </div>

              <FormField label="Likelihood" error={errors.inherentLikelihood?.message}>
                <select {...register('inherentLikelihood')} className={inputClass(false)}>
                  {Object.entries(LIKELIHOOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Impact" error={errors.inherentImpact?.message}>
                <select {...register('inherentImpact')} className={inputClass(false)}>
                  {Object.entries(IMPACT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Treatment" error={errors.treatment?.message} className="col-span-2">
                <select {...register('treatment')} className={inputClass(false)}>
                  {Object.entries(TREATMENT_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              {/* Residual risk */}
              <div className="col-span-2 mt-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Residual Risk</span>
                <ScoreBadge score={residualPreview} />
              </div>

              <FormField label="Residual Likelihood" error={errors.residualLikelihood?.message}>
                <select {...register('residualLikelihood')} className={inputClass(false)}>
                  {Object.entries(LIKELIHOOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Residual Impact" error={errors.residualImpact?.message}>
                <select {...register('residualImpact')} className={inputClass(false)}>
                  {Object.entries(IMPACT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Mitigation Plan" error={errors.mitigationPlan?.message} className="col-span-2">
                <textarea {...register('mitigationPlan')} rows={2} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Owner ID (optional)" error={errors.ownerId?.message} className="col-span-2">
                <input
                  {...register('ownerId')}
                  placeholder="User UUID"
                  className={inputClass(!!errors.ownerId)}
                />
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
              {isEditing ? 'Save Changes' : 'Create Risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }): JSX.Element {
  const sev = scoreSeverity(score);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', sev.bgColor, sev.color)}>
      Score {Number.isFinite(score) ? score : 0} · {sev.label}
    </span>
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
