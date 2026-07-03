import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DepartmentWithRelations } from '../types/departments.types';
import { useCreateDepartment, useUpdateDepartment, useDepartments } from '../hooks/use-departments';
import { useBranches } from '@/features/branches/hooks/use-branches';

const uuidOrNull = z.string().uuid().optional().nullable();

const schema = z.object({
  name:               z.string().min(1, 'Name is required').max(255),
  code:               z.string().max(50).optional().nullable(),
  branchId:           uuidOrNull,
  parentDepartmentId: uuidOrNull,
  description:        z.string().max(1000).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  department?: DepartmentWithRelations;
}

export function DepartmentFormModal({ open, onClose, department }: Props): JSX.Element | null {

  const isEditing = !!department;
  const { mutate: create, isPending: isCreating } = useCreateDepartment();
  const { mutate: update, isPending: isUpdating } = useUpdateDepartment();
  const isPending = isCreating || isUpdating;

  const { data: branchesData } = useBranches({ isActive: true, limit: 100 });
  const { data: deptsData } = useDepartments({ isActive: true, limit: 100 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: department
      ? {
          name:               department.name,
          code:               department.code ?? '',
          branchId:           department.branchId ?? '',
          parentDepartmentId: department.parentDepartmentId ?? '',
          description:        department.description ?? '',
        }
      : { name: '' },
  });

  useEffect(() => {
    if (open && !department) reset({ name: '' });
  }, [open, department, reset]);

  const onSubmit = (values: FormValues) => {
    const dto = {
      name:               values.name,
      code:               values.code || null,
      branchId:           values.branchId || null,
      parentDepartmentId: values.parentDepartmentId || null,
      description:        values.description || null,
    };

    if (isEditing) {
      update({ id: department.id, dto }, { onSuccess: onClose });
    } else {
      create(dto, { onSuccess: onClose });
    }
  };

  // Exclude self from parent options when editing
  const parentOptions = deptsData?.departments?.filter(
    (d) => !isEditing || d.id !== department?.id,
  ) ?? [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? 'Edit Department' : 'Add Department'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department Name" error={errors.name?.message} required className="col-span-2">
              <input {...register('name')} autoFocus className={inputClass(!!errors.name)} />
            </FormField>

            <FormField label="Code" error={errors.code?.message}>
              <input {...register('code')} placeholder="e.g. ENG-01" className={inputClass(false)} />
            </FormField>

            <FormField label="Branch" error={errors.branchId?.message}>
              <select {...register('branchId')} className={inputClass(false)}>
                <option value="">No branch</option>
                {branchesData?.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Parent Department" error={errors.parentDepartmentId?.message} className="col-span-2">
              <select {...register('parentDepartmentId')} className={inputClass(false)}>
                <option value="">Top-level department</option>
                {parentOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Description" error={errors.description?.message} className="col-span-2">
              <textarea
                {...register('description')}
                rows={3}
                className={cn(inputClass(false), 'resize-none')}
                placeholder="Optional description..."
              />
            </FormField>
          </div>

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
              {isEditing ? 'Save Changes' : 'Add Department'}
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
