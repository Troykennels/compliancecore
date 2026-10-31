import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import { humanize } from '@/lib/labels';

interface Coverage {
  id: string;
  type: string;
  title: string;
  reference: string | null;
  framework: string | null;
}
const pages: Record<string, string> = {
  control: '/controls',
  risk: '/risks',
  policy: '/policies',
  audit: '/audits',
  vendor: '/vendors',
};
export function EvidenceCoverage({ evidenceId }: { evidenceId: string }) {
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['evidence-coverage', evidenceId],
    queryFn: () =>
      apiClient
        .get<ApiResponse<Coverage[]>>(`/evidence/${evidenceId}/coverage`)
        .then((r) => r.data.data),
  });
  return (
    <section className="space-y-2" aria-label="What this evidence supports">
      <h2 className="text-sm font-semibold text-slate-900">What this evidence supports</h2>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading linked records…</p>
      ) : isError ? (
        <button className="text-sm text-brand-700 underline" onClick={() => void refetch()}>
          Retry linked records
        </button>
      ) : !data.length ? (
        <p className="text-sm text-slate-500">
          No linked requirements or records. Add this evidence from the relevant control, policy or
          assessment before relying on it for coverage.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((item, index) => (
            <li key={`${item.type}:${item.id}:${index}`} className="text-sm">
              <p className="text-xs text-slate-500">
                {humanize(item.type)}
                {item.framework ? ` · ${item.framework}` : ''}
              </p>
              <Link
                className="text-brand-700 underline"
                to={
                  item.type === 'audit'
                    ? `/audits/${item.id}`
                    : `${pages[item.type] ?? '/frameworks'}?recordId=${item.id}`
                }
              >
                {item.reference ? `${item.reference} · ` : ''}
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        A link records intended coverage; it does not establish that a requirement has passed
        review.
      </p>
    </section>
  );
}
