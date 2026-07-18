import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Vendor } from '../types/vendors.types';
import { RISK_LEVEL_CONFIG, VENDOR_STATUS_CONFIG } from '../types/vendors.types';
import { useCreateVendor, useUpdateVendor } from '../hooks/use-vendors';

const schema = z.object({
  name:           z.string().min(1, 'Name is required').max(500),
  description:    z.string().max(10000).optional(),
  category:       z.string().max(100).optional(),
  website:        z.string().max(500).optional(),
  contactName:    z.string().max(255).optional(),
  contactEmail:   z.string().email('Invalid email').max(320).optional().or(z.literal('')),
  riskLevel:      z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  status:         z.enum(['active', 'under_review', 'inactive', 'offboarded']).default('active'),
  dataProcessed:  z.string().max(10000).optional(),
  nextReviewDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  vendor?: Vendor; // if set, editing; otherwise creating
}

const DEFAULTS: FormValues = {
  name:           '',
  description:    '',
  category:       '',
  website:        '',
  contactName:    '',
  contactEmail:   '',
  riskLevel:      'medium',
  status:         'active',
  dataProcessed:  '',
  nextReviewDate: '',
};

export function VendorFormModal({ open, onClose, vendor }: Props): JSX.Element | null {
  const isEditing = !!vendor;
  const { mutate: create, isPending: isCreating } = useCreateVendor();
  const { mutate: update, isPending: isUpdating } = useUpdateVendor();
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
    if (vendor) {
      reset({
        name:           vendor.name,
        description:    vendor.description ?? '',
        category:       vendor.category ?? '',
        website:        vendor.website ?? '',
        contactName:    vendor.contactName ?? '',
        contactEmail:   vendor.contactEmail ?? '',
        riskLevel:      vendor.riskLevel,
        status:         vendor.status,
        dataProcessed:  vendor.dataProcessed ?? '',
        nextReviewDate: vendor.nextReviewDate ? vendor.nextReviewDate.slice(0, 10) : '',
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, vendor, reset]);

  const onSubmit = (values: FormValues) => {
    const input = {
      name:           values.name,
      description:    values.description || null,
      category:       values.category || null,
      website:        values.website || null,
      contactName:    values.contactName || null,
      contactEmail:   values.contactEmail || null,
      riskLevel:      values.riskLevel,
      status:         values.status,
      dataProcessed:  values.dataProcessed || null,
      nextReviewDate: values.nextReviewDate ? new Date(values.nextReviewDate).toISOString() : null,
    };

    if (isEditing) {
      update({ id: vendor.id, input }, { onSuccess: onClose });
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
            {isEditing ? 'Edit Vendor' : 'New Vendor'}
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
              <FormField label="Name" error={errors.name?.message} required className="col-span-2">
                <input
                  {...register('name')}
                  autoFocus
                  placeholder="e.g. Acme Cloud Services"
                  className={inputClass(!!errors.name)}
                />
              </FormField>

              <FormField label="Description" error={errors.description?.message} className="col-span-2">
                <textarea {...register('description')} rows={3} className={cn(inputClass(false), 'resize-none')} />
              </FormField>

              <FormField label="Category" error={errors.category?.message}>
                <input
                  {...register('category')}
                  placeholder="e.g. Infrastructure"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Website" error={errors.website?.message}>
                <input
                  {...register('website')}
                  placeholder="https://example.com"
                  className={inputClass(false)}
                />
              </FormField>

              <FormField label="Contact Name" error={errors.contactName?.message}>
                <input {...register('contactName')} className={inputClass(false)} />
              </FormField>

              <FormField label="Contact Email" error={errors.contactEmail?.message}>
                <input {...register('contactEmail')} className={inputClass(!!errors.contactEmail)} />
              </FormField>

              <FormField label="Risk Level" error={errors.riskLevel?.message}>
                <select {...register('riskLevel')} className={inputClass(false)}>
                  {Object.entries(RISK_LEVEL_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputClass(false)}>
                  {Object.entries(VENDOR_STATUS_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Next Review Date" error={errors.nextReviewDate?.message}>
                <input type="date" {...register('nextReviewDate')} className={inputClass(false)} />
              </FormField>

              <FormField label="Data Processed" error={errors.dataProcessed?.message} className="col-span-2">
                <textarea {...register('dataProcessed')} rows={2} className={cn(inputClass(false), 'resize-none')} />
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
              {isEditing ? 'Save Changes' : 'Create Vendor'}
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
