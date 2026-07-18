import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, X, Copy, Eye, EyeOff, Loader2, Key, Trash2, Check, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { settingsApi } from '../api/settings.api';
import { SettingsLayout } from '../components/settings-layout';
import type { ApiKeyCreated } from '../types/settings.types';

const API_PERMISSIONS = [
  { value: 'controls:read',   label: 'Controls — Read' },
  { value: 'controls:write',  label: 'Controls — Write' },
  { value: 'evidence:read',   label: 'Evidence — Read' },
  { value: 'evidence:write',  label: 'Evidence — Write' },
  { value: 'frameworks:read', label: 'Frameworks — Read' },
  { value: 'policies:read',   label: 'Policies — Read' },
  { value: 'policies:write',  label: 'Policies — Write' },
  { value: 'risks:read',      label: 'Risks — Read' },
  { value: 'risks:write',     label: 'Risks — Write' },
  { value: 'audits:read',     label: 'Audits — Read' },
  { value: 'reports:read',    label: 'Reports — Read' },
];

const schema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
  expiresAt:   z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export function SettingsApiKeysPage(): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: () => settingsApi.listApiKeys().then((r) => r.data.data.apiKeys),
  });

  const { mutate: createKey, isPending: isCreating } = useMutation({
    mutationFn: (values: FormValues) =>
      settingsApi
        .createApiKey({ ...values, expiresAt: values.expiresAt || null })
        .then((r) => r.data.data.apiKey),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
      setCreatedKey(key);
      setCreateOpen(false);
    },
    onError: () => toast.error('Failed to create API key.'),
  });

  const { mutate: revokeKey, isPending: isRevoking } = useMutation({
    mutationFn: (id: string) => settingsApi.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
      toast.success('API key revoked.');
      setRevokeId(null);
    },
    onError: () => toast.error('Failed to revoke API key.'),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { permissions: [], name: '' },
  });

  function copyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">API Keys</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Create keys to authenticate the ComplianceCore API from your systems.
              </p>
            </div>
            <button
              onClick={() => { setCreateOpen(true); reset(); }}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New Key
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-500">
              <AlertTriangle className="h-8 w-8 text-slate-300" />
              <p className="text-sm">Failed to load API keys.</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Key className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No API keys</p>
              <p className="mt-1 text-xs text-slate-500">Create a key to start using the API.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Prefix</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Last Used</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Expires</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{key.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{key.keyPrefix}…</td>
                    <td className="px-6 py-4 text-slate-500">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setRevokeId(key.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Security Note */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          API keys grant access to your organisation's data. Store them securely and never share them in public repositories.
        </div>
      </div>

      {/* Create Key Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Create API Key</h3>
              <button onClick={() => setCreateOpen(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit((v) => createKey(v))} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Key Name <span className="text-rose-500">*</span>
                </label>
                <input
                  {...register('name')}
                  autoFocus
                  placeholder="e.g. Production CI/CD"
                  className={cn('block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600', errors.name ? 'border-rose-500' : 'border-slate-300')}
                />
                {errors.name && <p className="text-xs text-rose-600">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Permissions <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 p-3">
                  {API_PERMISSIONS.map((p) => (
                    <label key={p.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        value={p.value}
                        {...register('permissions')}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
                {errors.permissions && (
                  <p className="text-xs text-rose-600">{errors.permissions.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Expiry Date <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  {...register('expiresAt')}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Your New API Key</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                This key will only be shown once. Copy it now and store it securely.
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <code className="flex-1 truncate font-mono text-sm text-slate-800">
                  {showKey ? createdKey.rawKey : '•'.repeat(40)}
                </code>
                <button onClick={() => setShowKey((v) => !v)} className="text-slate-400 hover:text-slate-600">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={copyKey} className="text-slate-400 hover:text-slate-600">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => { setCreatedKey(null); setShowKey(false); }}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirm */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRevokeId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Revoke API Key?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Any services using this key will immediately lose access. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setRevokeId(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button
                onClick={() => revokeKey(revokeId)}
                disabled={isRevoking}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isRevoking ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
