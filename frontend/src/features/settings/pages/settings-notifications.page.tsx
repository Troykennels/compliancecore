import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { settingsApi } from '../api/settings.api';
import { SettingsLayout } from '../components/settings-layout';
import type { NotificationSettings } from '../types/settings.types';

const EMAIL_ALERT_LABELS: Record<keyof NotificationSettings['emailAlerts'], string> = {
  controlDue:         'Control task due soon',
  controlOverdue:     'Control task overdue',
  evidenceRequested:  'Evidence requested from you',
  auditStarted:       'Audit started',
  riskCreated:        'New risk created',
  incidentCreated:    'New incident reported',
  frameworkAssigned:  'Framework assigned to you',
};

const DIGEST_OPTIONS: { value: NotificationSettings['digestFrequency']; label: string }[] = [
  { value: 'realtime', label: 'Real-time (instant)' },
  { value: 'daily',    label: 'Daily digest (8:00 AM)' },
  { value: 'weekly',   label: 'Weekly digest (Monday 8:00 AM)' },
  { value: 'never',    label: 'Never (no emails)' },
];

export function SettingsNotificationsPage(): JSX.Element {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () =>
      settingsApi.getNotificationSettings().then((r) => r.data.data.notificationSettings),
  });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: (values: NotificationSettings) =>
      settingsApi.updateNotificationSettings(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] });
      toast.success('Notification settings saved.');
    },
    onError: () => toast.error('Failed to save notification settings.'),
  });

  const { control, handleSubmit, reset, register } = useForm<NotificationSettings>();

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  return (
    <SettingsLayout>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : isError || !data ? (
          // Block the form when the fetch failed — otherwise the form holds blank
          // defaults (reset(data) never ran) and Saving would wipe real settings.
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500 shadow-sm">
            <AlertTriangle className="h-8 w-8 text-slate-300" />
            <p className="text-sm">Failed to load notification settings.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => save(v))} className="space-y-4">
            {/* Email Alerts */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">Email Alerts</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Choose which events trigger an email notification to you.
                </p>
              </div>
              <div className="divide-y divide-slate-100 p-6">
                {(Object.entries(EMAIL_ALERT_LABELS) as [keyof NotificationSettings['emailAlerts'], string][]).map(
                  ([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-4 py-3 cursor-pointer"
                    >
                      <span className="text-sm text-slate-700">{label}</span>
                      <Controller
                        control={control}
                        name={`emailAlerts.${key}`}
                        render={({ field }) => (
                          <Toggle checked={!!field.value} onChange={field.onChange} />
                        )}
                      />
                    </label>
                  ),
                )}
              </div>
            </section>

            {/* Digest Frequency */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">Email Digest</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  How often would you like to receive a summary digest?
                </p>
              </div>
              <div className="p-6 space-y-2">
                {DIGEST_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      {...register('digestFrequency')}
                      className="h-4 w-4 border-slate-300 text-indigo-600"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Integration Webhooks (Slack / Teams) */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">Chat Integrations</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Receive alerts directly in Slack or Microsoft Teams.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Slack Webhook URL
                  </label>
                  <input
                    {...register('slackWebhookUrl')}
                    type="url"
                    placeholder="https://hooks.slack.com/services/…"
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Microsoft Teams Webhook URL
                  </label>
                  <input
                    {...register('teamsWebhookUrl')}
                    type="url"
                    placeholder="https://prod.webhooks.office.com/…"
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white',
                  'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Preferences
              </button>
            </div>
          </form>
        )}
      </div>
    </SettingsLayout>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
        checked ? 'bg-indigo-600' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
