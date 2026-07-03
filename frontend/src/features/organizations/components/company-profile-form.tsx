import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrganizationProfile } from '../types/organization.types';
import {
  ORG_SIZES,
  INDUSTRIES,
  DATE_FORMATS,
} from '../types/organization.types';
import { useUpdateOrganization } from '../hooks/use-organization';

const schema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(255),
  industry:    z.string().max(100).optional().nullable(),
  website:     z.string().url('Must be a valid URL').max(255).optional().nullable().or(z.literal('')),
  phone:       z.string().max(50).optional().nullable(),
  country:     z.string().max(100).optional().nullable(),
  city:        z.string().max(100).optional().nullable(),
  address:     z.string().max(500).optional().nullable(),
  postalCode:  z.string().max(20).optional().nullable(),
  size:        z.string().optional().nullable(),
  timezone:    z.string().optional(),
  dateFormat:  z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY']).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  organization: OrganizationProfile;
}

export function CompanyProfileForm({ organization }: Props): JSX.Element {
  const { mutate, isPending } = useUpdateOrganization();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:       organization.name,
      industry:   organization.industry ?? '',
      website:    organization.website ?? '',
      phone:      organization.phone ?? '',
      country:    organization.country ?? '',
      city:       organization.city ?? '',
      address:    organization.address ?? '',
      postalCode: organization.postalCode ?? '',
      size:       organization.size ?? '',
      timezone:   organization.timezone,
      dateFormat: organization.dateFormat,
    },
  });

  // Keep form in sync if profile re-fetched
  useEffect(() => {
    reset({
      name:       organization.name,
      industry:   organization.industry ?? '',
      website:    organization.website ?? '',
      phone:      organization.phone ?? '',
      country:    organization.country ?? '',
      city:       organization.city ?? '',
      address:    organization.address ?? '',
      postalCode: organization.postalCode ?? '',
      size:       organization.size ?? '',
      timezone:   organization.timezone,
      dateFormat: organization.dateFormat,
    });
  }, [organization, reset]);

  const onSubmit = (values: FormValues) => {
    mutate({
      name:       values.name,
      industry:   values.industry || null,
      website:    values.website || null,
      phone:      values.phone || null,
      country:    values.country || null,
      city:       values.city || null,
      address:    values.address || null,
      postalCode: values.postalCode || null,
      size:       (values.size || null) as OrganizationProfile['size'],
      timezone:   values.timezone,
      dateFormat: values.dateFormat,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Basic Information
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Organisation Name" error={errors.name?.message} required>
            <input {...register('name')} className={inputClass(!!errors.name)} />
          </Field>

          <Field label="Industry" error={errors.industry?.message}>
            <select {...register('industry')} className={inputClass(false)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </Field>

          <Field label="Company Size" error={errors.size?.message}>
            <select {...register('size')} className={inputClass(false)}>
              <option value="">Select size</option>
              {ORG_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Website" error={errors.website?.message}>
            <input
              {...register('website')}
              type="url"
              placeholder="https://example.com"
              className={inputClass(!!errors.website)}
            />
          </Field>

          <Field label="Phone" error={errors.phone?.message}>
            <input {...register('phone')} type="tel" placeholder="+44 20 1234 5678" className={inputClass(false)} />
          </Field>
        </div>
      </section>

      {/* Address */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Address
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country" error={errors.country?.message} className="sm:col-span-2">
            <input {...register('country')} placeholder="United Kingdom" className={inputClass(false)} />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <input {...register('city')} placeholder="London" className={inputClass(false)} />
          </Field>
          <Field label="Postal Code" error={errors.postalCode?.message}>
            <input {...register('postalCode')} placeholder="EC1A 1BB" className={inputClass(false)} />
          </Field>
          <Field label="Street Address" error={errors.address?.message} className="sm:col-span-2">
            <input {...register('address')} placeholder="123 Main Street" className={inputClass(false)} />
          </Field>
        </div>
      </section>

      {/* Localisation */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Localisation
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date Format" error={errors.dateFormat?.message}>
            <select {...register('dateFormat')} className={inputClass(false)}>
              {DATE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <p className="flex-1 text-xs text-slate-500">
          Data residency region can only be changed by contacting support.
        </p>
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white',
            'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600',
            'focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, error, required, className, children }: FieldProps): JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
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
    'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors',
    hasError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white',
  );
}
