import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ListChecks, ClipboardCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

interface WorkItem {
  id: string;
  title: string;
}
export function RoleWork() {
  const role = useAuthStore((s) => s.activeTenant?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const auditor = role === 'auditor';
  const owner = role === 'control_owner';
  const q = useQuery({
    queryKey: ['role-work', role, userId],
    enabled: auditor || owner,
    queryFn: async () => {
      if (auditor) {
        const result = (
          await apiClient.get<ApiResponse<{ audits: WorkItem[]; total: number }>>('/audits', {
            params: { status: 'in_progress', limit: 5 },
          })
        ).data.data;
        return {
          records: result.audits,
          total: result.total,
          href: '/audits?status=in_progress',
          label: 'Audits in progress',
        };
      }
      const result = (
        await apiClient.get<ApiResponse<{ controls: WorkItem[]; total: number }>>('/controls', {
          params: { ownerId: userId, limit: 5 },
        })
      ).data.data;
      return {
        records: result.controls,
        total: result.total,
        href: `/controls?ownerId=${userId}`,
        label: 'Your assigned controls',
      };
    },
  });
  const tasks = useQuery({
    queryKey: ['role-work-tasks', userId],
    enabled: owner,
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<{ items: WorkItem[]; total: number }>
        >('/tasks', { params: { myTasks: true, limit: 5 } })
        .then((r) => r.data.data),
  });
  if (!auditor && !owner) return null;
  return (
    <section
      aria-label="Your role priorities"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {auditor ? (
            <ClipboardCheck className="h-5 w-5 text-brand-700" />
          ) : (
            <ListChecks className="h-5 w-5 text-brand-700" />
          )}
          {auditor ? 'Your audit workspace' : 'Your assigned work'}
        </h2>
        <Link
          to="/settings/notifications"
          className="text-xs font-semibold text-brand-700 underline"
        >
          Reminder preferences
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {auditor
          ? 'Review active engagements, examine supporting records and record independent decisions.'
          : 'Start with the safeguards and tasks assigned to you. Keep their evidence and status current.'}
      </p>
      {q.isLoading ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Loading your work…
        </p>
      ) : q.isError ? (
        <button className="mt-4 text-sm text-brand-700 underline" onClick={() => void q.refetch()}>
          Retry your work list
        </button>
      ) : (
        q.data && (
          <div className="mt-4">
            <Link
              to={q.data.href}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold"
            >
              {q.data.label}
              <span>
                {q.data.total}
                <ArrowUpRight className="ml-2 inline h-4 w-4" />
              </span>
            </Link>
            <ul className="divide-y divide-slate-100">
              {q.data.records.map((r) => (
                <li key={r.id}>
                  <Link
                    className="block py-3 text-sm text-brand-800 hover:underline"
                    to={auditor ? `/audits/${r.id}` : `/controls?recordId=${r.id}`}
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
            {!q.data.records.length && (
              <p className="mt-3 text-sm text-slate-500">No records in this work list.</p>
            )}
          </div>
        )
      )}
      {owner && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Link className="text-sm font-semibold text-brand-700" to="/tasks?myTasks=true">
            Your tasks{tasks.data ? ` (${tasks.data.total})` : ''}{' '}
            <ArrowUpRight className="inline h-4 w-4" />
          </Link>
          {tasks.isError && (
            <button className="ml-3 text-xs underline" onClick={() => void tasks.refetch()}>
              Retry tasks
            </button>
          )}
          <ul className="mt-2 space-y-2">
            {tasks.data?.items.map((t) => (
              <li key={t.id}>
                <Link className="text-sm text-slate-600 hover:underline" to={`/tasks/${t.id}`}>
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
