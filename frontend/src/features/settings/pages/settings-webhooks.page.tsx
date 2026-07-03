import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X, Loader2, Webhook, Trash2, Copy, Check, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { settingsApi } from '../api/settings.api';
import { SettingsLayout } from '../components/settings-layout';
import { WEBHOOK_EVENTS, type WebhookCreated } from '../types/settings.types';

const schema = z.object({
  name:   z.string().min(1, 'Name is required').max(100),
  url:    z.string().url('Must be a valid HTTPS URL').max(2048),
  events: z.array(z.string()).min(1, 'Select at least one event'),
});

type FormValues = z.infer<typeof schema>;

export function SettingsWebhooksPage(): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<WebhookCreated | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'webhooks'],
    queryFn: () => settingsApi.listWebhooks().then((r) => r.data.data.webhooks),
  });

  const { mutate: createWebhook, isPending: isCreating } = useMutation({
    mutationFn: (values: FormValues) =>
      settingsApi.createWebhook(values).then((r) => r.data.data.webhook),
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'webhooks'] });
      setCreatedWebhook(webhook);
      setCreateOpen(false);
    },
    onError: () => toast.error('Failed to create webhook.'),
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      settingsApi.updateWebhook(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'webhooks'] }),
    onError: () => toast.error('Failed to update webhook.'),
  });

  const { mutate: deleteWebhook, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => settingsApi.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'webhooks'] });
      toast.success('Webhook deleted.');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete webhook.'),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { events: [] },
  });

  function copySecret() {
    if (!createdWebhook) return;
    navigator.clipboard.writeText(createdWebhook.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Webhooks</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Send real-time event notifications to your services.
              </p>
            </div>
            <button
              onClick={() => { setCreateOpen(true); reset(); }}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Webhook
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Webhook className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No webhooks configured</p>
              <p className="mt-1 text-xs text-slate-500">Add a webhook to receive event notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.map((wh) => (
                <div key={wh.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{wh.name}</p>
                      {wh.isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-400" />
                      )}
                      {wh.failureCount > 3 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          {wh.failureCount} failures
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500 font-mono">{wh.url}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {wh.events.length} event{wh.events.length !== 1 ? 's' : ''} ·{' '}
                      {wh.lastTriggeredAt
                        ? `Last triggered ${new Date(wh.lastTriggeredAt).toLocaleDateString()}`
                        : 'Never triggered'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive({ id: wh.id, isActive: !wh.isActive })}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        wh.isActive
                          ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                      )}
                    >
                      {wh.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setDeleteId(wh.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Webhooks are signed with HMAC-SHA256 using your webhook secret. Verify the{' '}
          <code className="font-mono">X-ComplianceCore-Signature</code> header on each request.
        </div>
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Add Webhook</h3>
              <button onClick={() => setCreateOpen(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit((v) => createWebhook(v))} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Name *</label>
                <input
                  {...register('name')}
                  autoFocus
                  className={cn('block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600', errors.name ? 'border-rose-500' : 'border-slate-300')}
                />
                {errors.name && <p className="text-xs text-rose-600">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Endpoint URL *</label>
                <input
                  {...register('url')}
                  type="url"
                  placeholder="https://your-service.com/webhook"
                  className={cn('block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600', errors.url ? 'border-rose-500' : 'border-slate-300')}
                />
                {errors.url && <p className="text-xs text-rose-600">{errors.url.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Events *</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-md border border-slate-200 p-3">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <label key={evt.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        value={evt.value}
                        {...register('events')}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      {evt.label}
                    </label>
                  ))}
                </div>
                {errors.events && <p className="text-xs text-rose-600">{errors.events.message}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                <button type="submit" disabled={isCreating} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webhook Created — Show Secret */}
      {createdWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Webhook Created</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                This signing secret will only be shown once. Copy and store it securely.
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Signing Secret</p>
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <code className="flex-1 truncate font-mono text-sm text-slate-800">
                    {createdWebhook.secret}
                  </code>
                  <button onClick={copySecret} className="text-slate-400 hover:text-slate-600">
                    {copiedSecret ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setCreatedWebhook(null)}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Webhook?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This endpoint will stop receiving event notifications immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={() => deleteWebhook(deleteId)} disabled={isDeleting} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
