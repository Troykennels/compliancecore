import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
      <p className="text-sm text-slate-600">
        Current recorded work, with a direct link to the records behind each
        count. These are work queues, not a declaration of compliance.
      </p>
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
          {q.data?.map((c) => (
            <Link
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              key={c.kind}
              to={c.href}
            >
              <p className="text-2xl font-bold text-indigo-800">{c.count}</p>
              <h3 className="mt-1 text-sm font-semibold">{c.title}</h3>
              <p className="mt-2 text-xs text-slate-600">{c.help}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
