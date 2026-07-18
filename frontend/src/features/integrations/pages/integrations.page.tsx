import { useNavigate } from 'react-router-dom';
import {
  Key,
  Webhook,
  Slack,
  MessagesSquare,
  Trello,
  HardDrive,
  ShieldCheck,
  Mail,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PATHS } from '@/routes/paths';

type LiveIntegration = {
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  cta: string;
};

type ComingSoonIntegration = {
  name: string;
  description: string;
  icon: LucideIcon;
};

const LIVE_INTEGRATIONS: LiveIntegration[] = [
  {
    name: 'API Keys',
    description: 'Authenticate the ComplianceCore REST API from your own systems and scripts.',
    icon: Key,
    path: PATHS.SETTINGS_API_KEYS,
    cta: 'Manage keys',
  },
  {
    name: 'Webhooks',
    description: 'Push real-time compliance events to your services as they happen.',
    icon: Webhook,
    path: PATHS.SETTINGS_WEBHOOKS,
    cta: 'Manage webhooks',
  },
];

const COMING_SOON_INTEGRATIONS: ComingSoonIntegration[] = [
  {
    name: 'Slack',
    description: 'Get compliance alerts and approvals directly in your team channels.',
    icon: Slack,
  },
  {
    name: 'Microsoft Teams',
    description: 'Route notifications and task reminders into Teams conversations.',
    icon: MessagesSquare,
  },
  {
    name: 'Jira',
    description: 'Sync remediation tasks and findings with your engineering backlog.',
    icon: Trello,
  },
  {
    name: 'Google Drive',
    description: 'Attach evidence and policy documents straight from Drive.',
    icon: HardDrive,
  },
  {
    name: 'Okta (SSO / SCIM)',
    description: 'Single sign-on and automated user provisioning for your workforce.',
    icon: ShieldCheck,
  },
  {
    name: 'Email / SMTP',
    description: 'Send notifications through your own outbound mail server.',
    icon: Mail,
  },
];

export function IntegrationsPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect ComplianceCore to the tools your team already uses.
          </p>
        </div>

        {/* Live / Available */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Available now
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_INTEGRATIONS.map((integration) => {
              const Icon = integration.icon;
              return (
                <div
                  key={integration.name}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {integration.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-slate-500">
                    {integration.description}
                  </p>
                  <button
                    onClick={() => navigate(integration.path)}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    {integration.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Coming soon */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Coming soon
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON_INTEGRATIONS.map((integration) => {
              const Icon = integration.icon;
              return (
                <div
                  key={integration.name}
                  className={cn(
                    'flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
                    'opacity-90',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      Coming soon
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {integration.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-slate-500">
                    {integration.description}
                  </p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-4 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400"
                  >
                    Not available yet
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
