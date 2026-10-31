import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  Key,
  Webhook,
  Slack,
  MessagesSquare,
  Mail,
  ShieldCheck,
  HardDrive,
  Trello,
  ArrowRight,
  Settings2,
  X,
  Loader2,
  Info,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';
import { PATHS } from '@/routes/paths';
import { supportMailto } from '@/config/contact';

type Provider = 'slack' | 'teams' | 'email';
type Config = {
  events: string[];
  includeDetails: boolean;
  transport: 'smtp' | 'brevo';
  host?: string;
  port: 465 | 587;
  from?: string;
};
type Connection = {
  provider: Provider;
  config: Config;
  enabled: boolean;
  verifiedAt: string | null;
  updatedAt: string;
  configuredSecrets: string[];
};
type Delivery = { id: string; isTest: boolean; status: string; message: string; createdAt: string };
const connectors = [
  {
    id: 'slack' as const,
    name: 'Slack',
    icon: Slack,
    description: 'Compliance alerts and approval notifications in your channel.',
    help: 'Create an incoming webhook in your Slack app, choose the channel, and paste its URL.',
    docs: 'https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/',
  },
  {
    id: 'teams' as const,
    name: 'Microsoft Teams',
    icon: MessagesSquare,
    description: 'Alerts and task reminders in a Teams channel.',
    help: 'Create a Teams Workflow using “When a Teams webhook request is received”. Select the channel, allow the webhook caller, and copy its URL. This connector sends Adaptive Cards.',
    docs: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
  },
  {
    id: 'email' as const,
    name: 'Email / SMTP',
    icon: Mail,
    description: 'Notifications through your SMTP server or Brevo account.',
    help: 'Use a verified sender. SMTP requires TLS on port 465 or 587. Choose Brevo HTTP if your hosting provider blocks SMTP.',
    docs: 'https://nodemailer.com/smtp',
  },
];
const events = [
  'approval_requested',
  'approval_decided',
  'approval_deadline_warning',
  'task_assigned',
  'task_comment',
  'control_overdue',
  'expiry_warning',
  'calendar_reminder',
  'score_drop',
  'escalation',
  'reminder',
  'system',
];
const emailEvents = ['expiry_warning', 'task_assigned', 'approval_decided', 'escalation'];
const label = (v: string) => v.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
const status = (c?: Connection) =>
  c?.enabled
    ? 'Enabled'
    : c?.verifiedAt
      ? 'Test passed · paused'
      : c
        ? 'Needs connection test'
        : 'Not connected';
const errorMessage = (e: unknown) =>
  isAxiosError(e)
    ? (e.response?.data?.error?.message ?? 'The server could not be reached. Try again.')
    : 'The action failed. Please try again.';
const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const defaults = (p: Provider): Config => ({
  events:
    p === 'email'
      ? emailEvents
      : ['approval_requested', 'approval_decided', 'task_assigned', 'escalation'],
  includeDetails: false,
  transport: 'smtp',
  port: 587,
});

export function IntegrationsPage(): JSX.Element {
  const [selected, setSelected] = useState<Provider | null>(null);
  const role = useAuthStore((s) => s.activeTenant?.role);
  const tenantId = useAuthStore((s) => s.activeTenant?.id);
  const canManage = hasPermission(role, 'settings:write');
  const query = useQuery({
    queryKey: ['notification-integrations', tenantId],
    queryFn: async () => (await apiClient.get<{ data: Connection[] }>('/integrations')).data.data,
  });
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        eyebrow="Tools"
        title="Integrations"
        description="Connect your compliance workflow to the tools your team uses. Keep every connection under your control."
      />
      <div className="my-6 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-slate-700">
        <ShieldCheck className="h-5 w-5 shrink-0 text-teal-700" />
        <div>
          <strong>Configure → Test → Enable</strong>
          <p className="mt-1">
            Credentials are encrypted. New connections stay paused until you test and enable them.
            Approval decisions remain in ComplianceCore.
          </p>
        </div>
      </div>
      {query.isError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          {errorMessage(query.error)}{' '}
          <button className="underline" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      )}
      <h2 className="mb-3 text-lg font-semibold">Notification connections</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {connectors.map((item) => {
          const c = query.data?.find((row) => row.provider === item.id);
          return (
            <article
              key={item.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
                  <item.icon className="h-6 w-6" />
                </div>
                <span
                  className={
                    'rounded-full px-2.5 py-1 text-xs ' +
                    (c?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')
                  }
                >
                  {query.isLoading ? 'Loading…' : status(c)}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{item.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.description}</p>
              <button
                disabled={
                  query.isLoading ||
                  query.isError ||
                  !canManage ||
                  (selected !== null && selected !== item.id)
                }
                onClick={() => setSelected(item.id)}
                className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Settings2 className="h-4 w-4" />
                {c ? 'Manage connection' : 'Set up connection'}
              </button>
            </article>
          );
        })}
      </div>
      {!canManage && (
        <p className="mt-3 text-sm text-slate-600">
          An organisation owner or administrator can configure connections.
        </p>
      )}
      {selected && !query.isLoading && (
        <ConnectionEditor
          key={tenantId + ':' + selected}
          provider={selected}
          connection={query.data?.find((c) => c.provider === selected)}
          onClose={() => setSelected(null)}
        />
      )}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Developer connections</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              name: 'API keys',
              description: 'Authenticate approved systems and scripts.',
              icon: Key,
              path: PATHS.SETTINGS_API_KEYS,
            },
            {
              name: 'Webhooks',
              description: 'Forward compliance events to your services.',
              icon: Webhook,
              path: PATHS.SETTINGS_WEBHOOKS,
            },
          ].map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <item.icon className="h-6 w-6 text-teal-700" />
              <div className="flex-1">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Planned connections</h2>
        <p className="mb-4 text-sm text-slate-600">
          These connectors are not available yet. Request one to share your requirements with
          support.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: 'Jira',
              icon: Trello,
              description: 'Link remediation tasks and findings to your backlog.',
            },
            {
              name: 'Google Drive',
              icon: HardDrive,
              description: 'Import selected evidence and policy documents.',
            },
            {
              name: 'Okta (SSO / SCIM)',
              icon: ShieldCheck,
              description: 'Organisation sign-in and user provisioning.',
            },
          ].map((item) => (
            <article key={item.name} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <item.icon className="h-6 w-6 text-slate-500" />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  Coming soon
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{item.name}</h3>
              <p className="my-2 text-sm text-slate-600">{item.description}</p>
              <a
                href={supportMailto('Integration request: ' + item.name)}
                className="mt-3 inline-block text-sm font-semibold text-teal-700 underline"
              >
                Request this integration
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ConnectionEditor({
  provider,
  connection,
  onClose,
}: {
  provider: Provider;
  connection?: Connection;
  onClose: () => void;
}) {
  const item = connectors.find((c) => c.id === provider)!;
  const client = useQueryClient();
  useEffect(() => {
    document.getElementById('connector-settings-' + provider)?.scrollIntoView({ block: 'start' });
  }, [provider]);
  const tenantId = useAuthStore((s) => s.activeTenant?.id);
  const [config, setConfig] = useState<Config>(connection?.config ?? defaults(provider));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false);
  const history = useQuery({
    queryKey: ['integration-deliveries', provider, tenantId],
    queryFn: async () =>
      (await apiClient.get<{ data: Delivery[] }>('/integrations/' + provider + '/deliveries')).data
        .data,
    enabled: !!connection,
  });
  const update = (key: keyof Config, value: unknown) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setMessage('');
  };
  async function action(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setDirty(false);
      setSecrets({});
      setMessage(success);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['notification-integrations'] }),
        client.invalidateQueries({ queryKey: ['integration-deliveries', provider] }),
      ]);
    } catch (e) {
      setError(errorMessage(e));
      await Promise.all([
        client.invalidateQueries({ queryKey: ['integration-deliveries', provider] }),
        client.invalidateQueries({ queryKey: ['notification-integrations'] }),
      ]);
    } finally {
      setBusy(false);
    }
  }
  const secretField = (key: string, title: string, help: string) => (
    <label className="block text-sm font-medium">
      {title}{' '}
      <span className="font-normal text-slate-500">
        {connection?.configuredSecrets.includes(key) ? '(saved; blank keeps it)' : '(required)'}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        value={secrets[key] ?? ''}
        onChange={(e) => {
          setSecrets((s) => ({ ...s, [key]: e.target.value }));
          setDirty(true);
        }}
        className={inputClass}
      />
      <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{help}</span>
    </label>
  );
  return (
    <section
      id={'connector-settings-' + provider}
      style={{ scrollMarginTop: 100 }}
      aria-label={item.name + ' connection settings'}
      className="mt-6 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <h2 className="font-semibold">{item.name} connection</h2>
          <p className="mt-1 text-xs text-slate-600">
            {status(connection)}
            {dirty ? ' · Unsaved changes' : ''}
          </p>
        </div>
        <button
          aria-label="Close connection settings"
          disabled={busy || dirty}
          onClick={onClose}
          className="rounded-lg p-2 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(
              () => apiClient.put('/integrations/' + provider, { config, secrets }),
              'Settings saved. Send a connection test next.',
            );
          }}
          className="min-w-0 space-y-5"
        >
          <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-3 text-sm font-semibold">1. Connection details</legend>
            {provider !== 'email' ? (
              secretField(
                'webhookUrl',
                'Webhook URL',
                'This secret URL grants access to the selected channel. It is never returned by the API.',
              )
            ) : (
              <>
                <label className="block text-sm font-medium">
                  Delivery method
                  <select
                    className={inputClass}
                    value={config.transport}
                    onChange={(e) => update('transport', e.target.value)}
                  >
                    <option value="smtp">SMTP with TLS</option>
                    <option value="brevo">Brevo HTTP API</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Sender email (required)
                  <input
                    type="email"
                    required
                    value={config.from ?? ''}
                    onChange={(e) => update('from', e.target.value)}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Use an address verified with your mail provider.
                  </span>
                </label>
                {config.transport === 'smtp' ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                      <label className="text-sm font-medium">
                        SMTP hostname (required)
                        <input
                          required
                          value={config.host ?? ''}
                          onChange={(e) => update('host', e.target.value)}
                          placeholder="smtp.example.com"
                          className={inputClass}
                        />
                      </label>
                      <label className="text-sm font-medium">
                        TLS port
                        <select
                          value={config.port}
                          onChange={(e) => update('port', Number(e.target.value))}
                          className={inputClass}
                        >
                          <option value={587}>587 · STARTTLS</option>
                          <option value={465}>465 · TLS</option>
                        </select>
                      </label>
                    </div>
                    {secretField(
                      'username',
                      'SMTP username',
                      'The login supplied by your mail provider.',
                    )}
                    {secretField(
                      'password',
                      'SMTP password',
                      'Use an application password if your provider requires one.',
                    )}
                  </>
                ) : (
                  secretField(
                    'apiKey',
                    'Brevo API key',
                    'Use an API key with transactional email permission.',
                  )
                )}
              </>
            )}
          </fieldset>
          <fieldset disabled={busy} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold">
              2. Notifications to send (required)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(provider === 'email' ? emailEvents : events).map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.events.includes(event)}
                    onChange={(e) =>
                      update(
                        'events',
                        e.target.checked
                          ? [...config.events, event]
                          : config.events.filter((x) => x !== event),
                      )
                    }
                  />
                  {label(event)}
                </label>
              ))}
            </div>
            <label className="mt-5 flex items-start gap-2 border-t border-slate-200 pt-4 text-sm">
              <input
                type="checkbox"
                checked={config.includeDetails}
                onChange={(e) => update('includeDetails', e.target.checked)}
                className="mt-1"
              />
              <span>
                Include notification titles and descriptions
                <span className="mt-1 block text-xs text-slate-500">
                  Optional. Confirm the destination is authorised to receive this information.
                  Otherwise only the event type and a link are sent.
                </span>
              </span>
            </label>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800"
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            <button
              disabled={busy || !config.events.length}
              className={buttonClass + ' bg-teal-700 text-white'}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save settings
            </button>
            <button
              type="button"
              disabled={busy || !connection || dirty}
              onClick={() =>
                void action(
                  () =>
                    apiClient.post('/integrations/' + provider + '/test', {}, { timeout: 45000 }),
                  'Provider accepted the test. Check your destination before enabling.',
                )
              }
              className={buttonClass}
            >
              Send connection test
            </button>
            <button
              type="button"
              disabled={
                busy || !connection || dirty || (!connection.enabled && !connection.verifiedAt)
              }
              onClick={() =>
                void action(
                  () =>
                    apiClient.patch('/integrations/' + provider, { enabled: !connection?.enabled }),
                  connection?.enabled
                    ? 'Notifications paused.'
                    : 'Notifications enabled for new events.',
                )
              }
              className={buttonClass}
            >
              {connection?.enabled ? 'Pause notifications' : 'Enable notifications'}
            </button>
          </div>
          {dirty && (
            <button
              type="button"
              className="text-sm text-slate-600 underline"
              onClick={() => {
                setConfig(connection?.config ?? defaults(provider));
                setSecrets({});
                setDirty(false);
                setError('');
              }}
            >
              Discard unsaved changes
            </button>
          )}
          {connection && (
            <div className="border-t border-slate-200 pt-3">
              {confirm ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <p>Remove credentials and delivery history? Notifications will stop.</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await apiClient.delete('/integrations/' + provider);
                        onClose();
                      }, 'Disconnected.')
                    }
                    className="font-semibold text-red-700 underline"
                  >
                    Confirm disconnect
                  </button>
                  <button type="button" onClick={() => setConfirm(false)} className="underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                  className="text-sm font-semibold text-red-700 underline"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </form>
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4 text-teal-700" />
              Setup guidance
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.help}</p>
            <a
              href={item.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-teal-700 underline"
            >
              Provider instructions ↗
            </a>
            <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-slate-600">
              <li>Save your settings. Changes pause delivery.</li>
              <li>
                Send a test
                {provider === 'email'
                  ? ' to your signed-in administrator email'
                  : ' to the configured channel'}
                .
              </li>
              <li>Check the destination, then enable notifications.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold">Delivery rules</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only new notifications are delivered, usually within 30 seconds. Paused connections
              send nothing. Email respects recipient preferences and replaces the platform email for
              selected events. Successful delivery means the provider accepted it.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Unconfirmed sends are not retried automatically. Check the destination before
              repeating a test. History is retained for 90 days.
            </p>
          </div>
        </aside>
      </div>
      <div className="border-t border-slate-200 p-5">
        <h3 className="mb-3 text-sm font-semibold">Recent deliveries</h3>
        {history.isError ? (
          <p role="alert" className="text-sm text-red-700">
            Delivery history could not load.{' '}
            <button onClick={() => void history.refetch()} className="underline">
              Retry
            </button>
          </p>
        ) : history.isLoading && connection ? (
          <p className="text-sm text-slate-500">Loading history…</p>
        ) : !history.data?.length ? (
          <p className="text-sm text-slate-500">No deliveries yet. Start with a connection test.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap p-3">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{d.isTest ? 'Test' : 'Notification'}</td>
                    <td className="p-3">
                      <span
                        className={
                          'rounded-full px-2 py-1 text-xs ' +
                          (d.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800')
                        }
                      >
                        {label(d.status)}
                      </span>
                    </td>
                    <td className="min-w-52 p-3 text-slate-600">
                      {d.message ?? 'Waiting for provider response.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
