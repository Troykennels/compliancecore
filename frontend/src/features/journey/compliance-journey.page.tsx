import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole, BellRing } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { useImplementationOverview } from '@/features/frameworks/implementation';
import { JourneyPathway } from './journey-pathway';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';

const operations = [
  {
    title: 'People and responsibilities',
    detail: 'Keep the organisation scope, team, branches and departments current.',
    links: [
      ['Organisation and scope', '/settings/organization', 'org:read'],
      ['Team and roles', '/settings/team', 'team:read'],
      ['Branches', '/branches', 'org:read'],
      ['Departments', '/departments', 'org:read'],
    ],
  },
  {
    title: 'Competence and awareness',
    detail: 'Assign training, retain completion evidence and track policy acknowledgments.',
    links: [
      ['Training and assignments', '/training', 'training:read'],
      ['Policies and acknowledgments', '/policies?workflow=acknowledgments', 'policies:read'],
    ],
  },
  {
    title: 'Suppliers and third parties',
    detail: 'Record supplier risk, review evidence and schedule the next assurance review.',
    links: [
      ['Vendor assurance', '/vendors', 'vendors:read'],
      ['Expiry and renewal dates', '/expiry', 'expiry:read'],
    ],
  },
  {
    title: 'Privacy and information handling',
    detail: 'Maintain processing records, handle data subject requests and review privacy impacts.',
    links: [
      ['Processing records', '/privacy/ropa', 'privacy:read'],
      ['Data subject requests', '/privacy/dsar', 'privacy:read'],
      ['Impact assessments', '/privacy/dpia', 'privacy:read'],
    ],
  },
  {
    title: 'Incidents and corrective work',
    detail: 'Record incidents, assess notification duties and verify that corrective actions work.',
    links: [
      ['Incident response', '/incidents', 'incidents:read'],
      ['Corrective tasks', '/tasks', 'tasks:read'],
      ['Escalations', '/escalations', 'escalations:read'],
    ],
  },
  {
    title: 'Assurance and independent decisions',
    detail:
      'Collect audit evidence, track findings and keep approvals separate from preparing work.',
    links: [
      ['Audits and evidence rooms', '/audits', 'audits:read'],
      ['Approvals', '/approvals', 'approvals:read'],
      ['Signatures', '/signatures', 'signatures:read'],
    ],
  },
  {
    title: 'Monitor, report and improve',
    detail:
      'Review changes, deadlines and expired evidence. Reopen an assessment when its supporting records change.',
    links: [
      ['Management reports', '/reports', 'reports:read'],
      ['Review calendar', '/calendar', 'calendar:read'],
      ['Expiry tracker', '/expiry', 'expiry:read'],
      ['Notifications', '/notifications', 'notifications:read'],
    ],
  },
] as const;

export function ComplianceJourneyPage() {
  const role = useAuthStore((s) => s.activeTenant?.role);
  const { data = [], isLoading, isError, refetch } = useImplementationOverview();
  return (
    <div className="cc-journey mx-auto max-w-none space-y-4 p-4 sm:p-5">
      <PageHeader
        eyebrow="Your programme, step by step"
        title="Compliance journey"
        description="One place to see the assessment sequence, return to your next action and maintain the work around it."
        actions={
          <Link
            to="/frameworks"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Open assessments
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <JourneyPathway
        assessments={data}
        loading={isLoading}
        error={isError}
        retry={() => void refetch()}
      />
      <div>
        <h2 className="text-lg font-semibold">Keep the programme running</h2>
        <p className="mt-1 text-sm text-slate-500">
          These workstreams support the assessment throughout its life. Open the records relevant to
          your organisation and responsibilities.
        </p>
      </div>
      <div className="cc-workstream-grid">
        {operations.map((area, index) => (
          <section key={area.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                {index + 1}
              </span>
              <h3 className="font-semibold">{area.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{area.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {area.links.map(([label, to, scope]) =>
                hasPermission(role, scope) ? (
                  <Link
                    key={to}
                    to={to}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-brand-800 hover:border-brand-200 hover:bg-brand-50"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={to}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400"
                  >
                    <LockKeyhole className="h-3 w-3" />
                    {label}
                  </span>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing className="h-5 w-5 text-brand-700" />
          Reminders and follow-up
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Set a named owner and due date on your records. Calendar and expiry reminders run daily,
          approval deadlines and escalation rules follow their configured schedules, and changed
          assessment records require a fresh review.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/settings/notifications"
            className="text-sm font-semibold text-brand-700 underline"
          >
            Your notification preferences
          </Link>
          <Link to="/guide" className="text-sm font-semibold text-brand-700 underline">
            Step-by-step user guide
          </Link>
        </div>
      </section>
    </div>
  );
}
