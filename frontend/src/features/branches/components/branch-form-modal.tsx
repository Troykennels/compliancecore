import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Branch } from '../types/branches.types';
import { useCreateBranch, useUpdateBranch } from '../hooks/use-branches';

const schema = z.object({
  name:            z.string().min(1, 'Name is required').max(255),
  code:            z.string().max(50).optional().nullable(),
  isHeadquarters:  z.boolean().optional().default(false),
  country:         z.string().max(100).optional().nullable(),
  city:            z.string().max(100).optional().nullable(),
  state:           z.string().max(100).optional().nullable(),
  address:         z.string().max(500).optional().nullable(),
  postalCode:      z.string().max(20).optional().nullable(),
  phone:           z.string().max(50).optional().nullable(),
  email:           z.string().email('Invalid email').max(255).optional().nullable().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  branch?: Branch; // if set, editing; otherwise creating
}

export function BranchFormModal({ open, onClose, branch }: Props): JSX.Element | null {

  const isEditing = !!branch;
  const { mutate: create, isPending: isCreating } = useCreateBranch();
  const { mutate: update, isPending: isUpdating } = useUpdateBranch();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: branch
      ? {
          name:           branch.name,
          code:           branch.code ?? '',
          isHeadquarters: branch.isHeadquarters,
          country:        branch.country ?? '',
          city:           branch.city ?? '',
          state:          branch.state ?? '',
          address:        branch.address ?? '',
          postalCode:     branch.postalCode ?? '',
          phone:          branch.phone ?? '',
          email:          branch.email ?? '',
        }
      : { name: '', isHeadquarters: false },
  });

  useEffect(() => {
    if (open && !branch) reset({ name: '', isHeadquarters: false });
  }, [open, branch, reset]);

  const onSubmit = (values: FormValues) => {
    const dto = {
      ...values,
      code:       values.code || null,
      country:    values.country || null,
      city:       values.city || null,
      state:      values.state || null,
      address:    values.address || null,
      postalCode: values.postalCode || null,
      phone:      values.phone || null,
      email:      values.email || null,
    };

    if (isEditing) {
      update({ id: branch.id, dto }, { onSuccess: onClose });
    } else {
      create(dto, { onSuccess: onClose });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? 'Edit Branch' : 'Add Branch'}
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Branch Name" error={errors.name?.message} required className="col-span-2">
              <input {...register('name')} autoFocus className={inputClass(!!errors.name)} />
            </FormField>

            <FormField label="Branch Code" error={errors.code?.message}>
              <input {...register('code')} placeholder="e.g. LON-01" className={inputClass(false)} />
            </FormField>

            <FormField label="">
              <label className="flex items-center gap-2 pt-7 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('isHeadquarters')} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                Mark as headquarters
              </label>
            </FormField>

            <FormField label="Country" error={errors.country?.message}>
              <input {...register('country')} placeholder="United Kingdom" className={inputClass(false)} />
            </FormField>

            <FormField label="City" error={errors.city?.message}>
              <input {...register('city')} placeholder="London" className={inputClass(false)} />
            </FormField>

            <FormField label="State / Region" error={errors.state?.message}>
              <input {...register('state')} placeholder="England" className={inputClass(false)} />
            </FormField>

            <FormField label="Postal Code" error={errors.postalCode?.message}>
              <input {...register('postalCode')} placeholder="EC1A 1BB" className={inputClass(false)} />
            </FormField>

            <FormField label="Address" error={errors.address?.message} className="col-span-2">
              <input {...register('address')} placeholder="123 Main Street" className={inputClass(false)} />
            </FormField>

            <FormField label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} type="tel" className={inputClass(false)} />
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" className={inputClass(!!errors.email)} />
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
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
              {isEditing ? 'Save Changes' : 'Add Branch'}
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
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
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
