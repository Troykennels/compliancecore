import type { FrameworkScore } from '../types/score.types';

interface FrameworkScoreCardProps {
  framework: FrameworkScore;
}

function barColor(score: number | null): string {
  if (score === null) return 'bg-slate-300';
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

export function FrameworkScoreCard({ framework }: FrameworkScoreCardProps) {
  const { frameworkName, score, controlCounts: c } = framework;
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">{frameworkName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{c.total} control{c.total !== 1 ? 's' : ''}</p>
        </div>
        <span className="text-xl font-bold text-slate-900 shrink-0">
          {score !== null ? `${Math.round(score)}%` : 'N/A'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Control breakdown */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md bg-green-50 px-2 py-1.5">
          <p className="text-sm font-bold text-green-700">{c.implemented}</p>
          <p className="text-[10px] text-green-600">Implemented</p>
        </div>
        <div className="rounded-md bg-amber-50 px-2 py-1.5">
          <p className="text-sm font-bold text-amber-700">{c.partiallyImplemented}</p>
          <p className="text-[10px] text-amber-600">Partial</p>
        </div>
        <div className="rounded-md bg-red-50 px-2 py-1.5">
          <p className="text-sm font-bold text-red-700">{c.notImplemented}</p>
          <p className="text-[10px] text-red-600">Not Impl.</p>
        </div>
      </div>
    </div>
  );
}
