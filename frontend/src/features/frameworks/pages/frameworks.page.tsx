import { useState } from 'react';
import {
  Library, Eye, Download, Loader2, Layers, CheckCircle2,
  AlertTriangle, RefreshCw, MapPin, Building2, ShieldCheck,
} from 'lucide-react';
import { useFrameworks, useAdoptFramework } from '../hooks/use-frameworks';
import { FrameworkDetailModal } from '../components/framework-detail-modal';
import type { Framework } from '../types/frameworks.types';

export function FrameworksPage(): JSX.Element {
  const { data, isLoading, isError, refetch } = useFrameworks();
  const { mutate: adopt, isPending: isAdopting, variables: adoptingId } = useAdoptFramework();
  const [detailId, setDetailId] = useState<string | null>(null);

  const frameworks = data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Frameworks</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse the shared framework library and adopt a framework to generate starter
            controls that drive your compliance score.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : frameworks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {frameworks.map((fw) => (
              <FrameworkCard
                key={fw.id}
                framework={fw}
                onView={() => setDetailId(fw.id)}
                onAdopt={() => adopt(fw.id)}
                isAdopting={isAdopting && adoptingId === fw.id}
              />
            ))}
          </div>
        )}
      </div>

      {detailId && (
        <FrameworkDetailModal frameworkId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

interface CardProps {
  framework: Framework;
  onView: () => void;
  onAdopt: () => void;
  isAdopting: boolean;
}

function FrameworkCard({ framework, onView, onAdopt, isAdopting }: CardProps): JSX.Element {
  const isAdopted = framework.adoptedControlCount > 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900" title={framework.name}>
            {framework.shortName || framework.name}
          </h3>
          {framework.shortName && (
            <p className="mt-0.5 truncate text-xs text-slate-500" title={framework.name}>
              {framework.name}
            </p>
          )}
        </div>
        {framework.version && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            v{framework.version}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        {framework.jurisdiction && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{framework.jurisdiction}</span>
          </div>
        )}
        {framework.issuingBody && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{framework.issuingBody}</span>
          </div>
        )}
      </div>

      {/* Counts. The library size is the number that matters — it is what
          adopting will actually give you — so it leads, and a framework with an
          empty library says so plainly rather than offering a button that
          quietly creates nothing. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Layers className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">{framework.categoryCount}</span> categories
        </div>
        {framework.libraryControlCount > 0 ? (
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-900">{framework.libraryControlCount}</span> controls available
          </div>
        ) : (
          <span className="text-amber-700">Controls coming soon</span>
        )}
        {isAdopted && (
          <div className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-semibold">{framework.adoptedControlCount}</span> adopted
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onView}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" /> View
        </button>
        <button
          onClick={onAdopt}
          disabled={isAdopting}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isAdopting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isAdopted ? 'Re-adopt' : 'Adopt'}
        </button>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangle className="h-7 w-7 text-rose-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Couldn't load frameworks</h3>
      <p className="mt-1 text-sm text-slate-500">Something went wrong while fetching the framework library.</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
        <Library className="h-7 w-7 text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">No frameworks available</h3>
      <p className="mt-1 text-sm text-slate-500">The shared framework library is currently empty.</p>
    </div>
  );
}
