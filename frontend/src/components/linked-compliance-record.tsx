import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import { humanize } from '@/lib/labels';
const modules = new Set([
  'controls',
  'risks',
  'policies',
  'vendors',
  'audits',
  'incidents',
  'calendar',
  'expiry',
  'training',
]);
export function LinkedComplianceRecord() {
  const fmt = useOrgFormat();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const id = params.get('record') ?? params.get('recordId') ?? '';
  const module = pathname.slice(1);
  const tenant = useAuthStore((s) => s.activeTenant?.id);
  const enabled = modules.has(module) && /^[a-f0-9-]{36}$/i.test(id);
  const q = useQuery({
    queryKey: ['linked-compliance-record', tenant, module, id],
    enabled,
    queryFn: async () =>
      (await apiClient.get<{ data: Record<string, unknown> }>(`/${module}/${id}`)).data.data,
  });
  if (!enabled) return null;
  const fields: Record<string, string> = {
    description: 'Description',
    content: 'Policy text',
    status: 'Status',
    implementationStatus: 'Operating status',
    implementationNotes: 'How the safeguard operates',
    testingNotes: 'Recorded test notes',
    ownerName: 'Responsible person',
    assignedToName: 'Assigned person',
    scope: 'Scope',
    summary: 'Summary',
    rootCause: 'Root cause',
    remediation: 'Remediation',
    lessonsLearned: 'Lessons',
    mitigationPlan: 'Risk treatment',
    reviewDueDate: 'Next review',
    dueDate: 'Due date',
    updatedAt: 'Last updated',
    startDate: 'Starts',
    endDate: 'Ends',
    expiryDate: 'Expires',
    priority: 'Priority',
  };
  return (
    <section
      aria-label="Linked source record"
      className="mx-4 my-4 min-w-0 rounded-xl border border-indigo-200 bg-white p-4 sm:mx-6"
    >
      {q.isLoading ? (
        <p role="status">Opening the linked record…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-red-800">
          This record is unavailable or your role cannot read it.{' '}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        q.data && (
          <>
            <h2 className="text-lg font-semibold">
              Linked record: {String(q.data.title ?? q.data.name ?? 'Source record')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This is the original saved record. The register below provides its available actions.
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(fields)
                .filter(
                  ([key]) =>
                    q.data?.[key] !== null && q.data?.[key] !== undefined && q.data?.[key] !== '',
                )
                .map(([key, label]) => (
                  <div
                    key={key}
                    className={
                      key === 'content' || key === 'description'
                        ? 'min-w-0 sm:col-span-2'
                        : 'min-w-0'
                    }
                  >
                    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-800">
                      {key === 'updatedAt'
                        ? fmt.formatDateTimeMedium(String(q.data?.[key]))
                        : /Date$/.test(key)
                          ? fmt.formatDateMedium(String(q.data?.[key]))
                          : ['status', 'implementationStatus', 'priority'].includes(key)
                            ? humanize(String(q.data?.[key]))
                            : String(q.data?.[key])}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )
      )}
    </section>
  );
}
