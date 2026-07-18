import { X, Loader2, Layers, Download, AlertTriangle } from 'lucide-react';
import { useFramework, useAdoptFramework } from '../hooks/use-frameworks';

interface Props {
  frameworkId: string;
  onClose: () => void;
}

export function FrameworkDetailModal({ frameworkId, onClose }: Props): JSX.Element {
  const { data: framework, isLoading, isError } = useFramework(frameworkId);
  const { mutate: adopt, isPending: isAdopting } = useAdoptFramework();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {framework?.name ?? 'Framework'}
            </h2>
            {framework && (
              <p className="mt-0.5 text-xs text-slate-500">
                {[framework.shortName, framework.version, framework.jurisdiction]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : isError || !framework ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle className="h-7 w-7 text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Couldn't load framework</h3>
              <p className="mt-1 text-sm text-slate-500">Something went wrong while fetching this framework.</p>
            </div>
          ) : (
            <>
              {framework.description && (
                <p className="mb-5 text-sm text-slate-600">{framework.description}</p>
              )}

              <dl className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Meta label="Issuing body" value={framework.issuingBody} />
                <Meta label="Version" value={framework.version} />
                <Meta label="Jurisdiction" value={framework.jurisdiction} />
                <Meta label="Categories" value={String(framework.categoryCount)} />
                <Meta label="Adopted controls" value={String(framework.adoptedControlCount)} />
              </dl>

              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Layers className="h-4 w-4 text-slate-400" />
                Categories ({framework.categories.length})
              </div>

              {framework.categories.length === 0 ? (
                <p className="text-sm text-slate-500">This framework has no categories defined.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {framework.categories.map((cat) => (
                    <li key={cat.id} className="px-4 py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs font-semibold text-indigo-600">{cat.code}</span>
                        <span className="text-sm font-medium text-slate-900">{cat.name}</span>
                      </div>
                      {cat.description && (
                        <p className="mt-1 text-xs text-slate-500">{cat.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isAdopting || isLoading || isError || !framework}
            onClick={() => adopt(frameworkId, { onSuccess: onClose })}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isAdopting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Adopt Framework
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }): JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
