import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import { SettingsLayout } from '../components/settings-layout';
import DeviceAlerts from '@/features/notifications/components/device-alerts';
import { humanize } from '@/lib/labels';

interface Preference {
  notificationType: string;
  inApp: boolean;
  email: boolean;
  emailAvailable: boolean;
}
export function SettingsNotificationsPage() {
  const qc = useQueryClient();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Preference[]>>('/notifications/preferences')
        .then((r) => r.data.data),
  });
  useEffect(() => {
    if (data) setPreferences(data);
  }, [data]);
  const save = useMutation({
    mutationFn: () =>
      apiClient.put('/notifications/preferences', {
        preferences: preferences.map(({ notificationType, inApp, email }) => ({
          notificationType,
          inApp,
          email,
        })),
      }),
    onSuccess: () => {
      toast.success('Your notification preferences were saved.');
      void qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: () => toast.error('Preferences could not be saved. Please try again.'),
  });
  function toggle(index: number, channel: 'inApp' | 'email', checked: boolean) {
    setPreferences((current) =>
      current.map((p, i) => (i === index ? { ...p, [channel]: checked } : p)),
    );
  }
  return (
    <SettingsLayout>
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Your notification preferences</h2>
          <p className="mt-2 text-sm text-slate-600">
            These choices apply to your account in the selected organisation. Email choices cover
            the event types with email delivery. Account security and billing messages continue
            separately.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Reminders run daily at 08:00 UTC. Each calendar event and expiry item has its own
            advance reminder days. Email digests are not available.
          </p>
          {isLoading ? (
            <p className="mt-4" role="status">
              Loading preferences...
            </p>
          ) : isError ? (
            <button className="mt-4 text-brand-700 underline" onClick={() => void refetch()}>
              Retry loading preferences
            </button>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <fieldset disabled={save.isPending} className="space-y-3">
                {preferences.map((p, index) => (
                  <div
                    key={p.notificationType}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"
                  >
                    <span className="text-sm font-medium">{humanize(p.notificationType)}</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.inApp}
                          onChange={(e) => toggle(index, 'inApp', e.target.checked)}
                        />
                        In-app<span className="sr-only"> {humanize(p.notificationType)}</span>
                      </label>
                      {p.emailAvailable ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={p.email}
                            onChange={(e) => toggle(index, 'email', e.target.checked)}
                          />
                          Email<span className="sr-only"> {humanize(p.notificationType)}</span>
                        </label>
                      ) : (
                        <span className="text-xs text-slate-400">In-app only</span>
                      )}
                    </div>
                  </div>
                ))}
              </fieldset>
              <button
                disabled={save.isPending}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {save.isPending ? 'Saving...' : 'Save preferences'}
              </button>
            </form>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white">
          <DeviceAlerts />
        </section>
        <Link className="inline-block text-sm text-brand-700 underline" to="/notifications">
          View notifications
        </Link>
      </div>
    </SettingsLayout>
  );
}
