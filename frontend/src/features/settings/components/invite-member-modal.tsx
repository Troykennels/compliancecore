import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { settingsApi } from '../api/settings.api';
import { ROLE_LABELS } from '../types/settings.types';

const INVITABLE_ROLES = [
  'admin',
  'compliance_manager',
  'control_owner',
  'auditor',
  'viewer',
] as const;

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
  role: z.enum(INVITABLE_ROLES, { errorMap: () => ({ message: 'Please select a role' }) }),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ open, onClose }: Props): JSX.Element | null {

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'viewer' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => settingsApi.inviteMember(data),
    onSuccess: () => {
      toast.success('Invitation sent successfully.');
      queryClient.invalidateQueries({ queryKey: ['settings', 'team'] });
      reset();
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to send invitation.');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Invite Team Member</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((v) => mutate(v))} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('email')}
              type="email"
              autoFocus
              placeholder="colleague@example.com"
              className={cn(
                'block w-full rounded-md border px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
                errors.email ? 'border-rose-500 bg-rose-50' : 'border-slate-300',
              )}
            />
            {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Role <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('role')}
              className={cn(
                'block w-full rounded-md border px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
                errors.role ? 'border-rose-500 bg-rose-50' : 'border-slate-300',
              )}
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            {errors.role && <p className="text-xs text-rose-600">{errors.role.message}</p>}

            {/* Role Description */}
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <RoleDescription />
            </div>
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
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleDescription(): JSX.Element {
  return (
    <div className="space-y-1">
      <p><strong>Admin</strong> — Full access except billing and owner management.</p>
      <p><strong>Compliance Manager</strong> — Manage controls, evidence, risks, and policies.</p>
      <p><strong>Control Owner</strong> — Update assigned controls and upload evidence.</p>
      <p><strong>Auditor</strong> — Read-only access to all compliance data.</p>
      <p><strong>Viewer</strong> — Read-only access to reports and dashboards.</p>
    </div>
  );
}
