import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ArrowUpRight } from 'lucide-react';
const queueTitles: Record<string, string> = { obligations: 'Duties to review', tests: 'Tests to review', actions: 'Corrections to check', acknowledgments: 'Policies to read' };
export function ComplianceWorkSummary() {
  const q = useQuery({
    queryKey: ["compliance-work-summary"],
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{
            kind: string;
            title: string;
            help: string;
            href: string;
            count: number;
          }>;
        }>("/frameworks/records/summary")
      ).data.data,
  });
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">What needs attention?</h2>
      <p className="text-xs text-slate-500">Choose a card to review the records and take the next action.</p>
      {q.isLoading ? (
        <p role="status">Loading work queues…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-red-800">
          Work queues could not be loaded.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {q.data?.map((c, i) => (
            <Link
              className={`rounded-xl border p-4 transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${['border-amber-200 bg-amber-50', 'border-blue-200 bg-blue-50', 'border-violet-200 bg-violet-50', 'border-green-200 bg-green-50'][i % 4]}`}
              key={c.kind}
              to={c.href}
            >
              <div className="flex items-center justify-between gap-2"><p className="text-2xl font-bold tabular-nums text-slate-900">{c.count}</p><ArrowUpRight className="h-4 w-4 text-slate-500" aria-hidden="true" /></div>
              <h3 className="mt-1 text-sm font-semibold">{queueTitles[c.kind] ?? c.title}</h3>
              <p className="mt-2 text-xs text-slate-600">{c.help}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
