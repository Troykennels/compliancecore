import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCreateExpiryItem, useUpdateExpiryItem } from '../hooks/use-expiry';
import type { ExpiryItem, ExpiryEntityType } from '../types/expiry.types';
import { ENTITY_TYPE_LABELS } from '../types/expiry.types';

const schema = z.object({
  name:         z.string().min(1, 'Name is required').max(500),
  entityType:   z.enum([
    'certificate','policy','contract','license','iso_certification',
    'penetration_test','insurance','vendor_assessment','audit_report',
    'training_certification','subscription','custom',
  ]).default('certificate'),
  expiryDate:   z.string().min(1, 'Expiry date is required'),
  reminderDays: z.string().default('90,30,7'),
  notes:        z.string().max(5000).optional(),
  status:       z.enum(['active','expiring_soon','expired','renewed','cancelled']).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExpiryFormModalProps {
  open: boolean;
  onClose: () => void;
  item?: ExpiryItem | null;
}

const TYPE_ENTRIES = Object.entries(ENTITY_TYPE_LABELS) as [ExpiryEntityType, string][];

export function ExpiryFormModal({ open, onClose, item }: ExpiryFormModalProps) {
  const create = useCreateExpiryItem();
  const update = useUpdateExpiryItem(item?.id ?? '');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          name:         item.name,
          entityType:   item.entityType,
          expiryDate:   format(parseISO(item.expiryDate), 'yyyy-MM-dd'),
          reminderDays: (item.reminderDays ?? [90, 30, 7]).join(','),
          notes:        item.notes ?? '',
          status:       item.status,
        });
      } else {
        reset({ name: '', entityType: 'certificate', expiryDate: '', reminderDays: '90,30,7', notes: '' });
      }
    }
  }, [open, item, reset]);

  const isSubmitting = create.isPending || update.isPending;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name:         values.name,
      entityType:   values.entityType as ExpiryEntityType,
      expiryDate:   values.expiryDate,
      reminderDays: values.reminderDays.split(',').map((d) => parseInt(d.trim(), 10)).filter(Boolean),
      notes:        values.notes || null,
      status:       values.status,
    };

    if (item) {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {item ? 'Edit Expiry Item' : 'Track New Expiry'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
              <input {...register('name')} placeholder="e.g. AWS SSL Certificate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Type</label>
                <select {...register('entityType')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {TYPE_ENTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Expiry Date *</label>
                <input type="date" {...register('expiryDate')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {errors.expiryDate && <p className="mt-0.5 text-xs text-red-600">{errors.expiryDate.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Remind (days before expiry)</label>
              <input {...register('reminderDays')} placeholder="90,30,7,1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <p className="mt-0.5 text-xs text-slate-400">Comma-separated (e.g. 90,30,7)</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
              <textarea {...register('notes')} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500" />
            </div>

            {item && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select {...register('status')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="expired">Expired</option>
                  <option value="renewed">Renewed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
