import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useCurrentScore, useScoreTrend, useTriggerSnapshot } from '../hooks/use-score';
import { ScoreGauge } from '../components/score-gauge';
import { FrameworkScoreCard } from '../components/framework-score-card';
import { ScoreTrendChart } from '../components/score-trend-chart';

const TREND_OPTIONS: { label: string; days: number }[] = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1y',  days: 365 },
];

export function ScorePage() {
  const [trendDays, setTrendDays] = useState(180);
  const { data: scoreData, isLoading: scoreLoading, isError: scoreError, refetch: refetchScore } = useCurrentScore();
  const { data: trendData = [], isLoading: trendLoading } = useScoreTrend(trendDays);
  const triggerSnapshot = useTriggerSnapshot();

  const frameworks = scoreData?.frameworks ?? [];

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Compliance Score</h1>
          <p className="text-sm text-slate-500 mt-0.5">Weighted score across all active frameworks</p>
        </div>
        <button
          onClick={() => triggerSnapshot.mutate()}
          disabled={triggerSnapshot.isPending}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${triggerSnapshot.isPending ? 'animate-spin' : ''}`} />
          Take Snapshot
        </button>
      </div>

      {scoreLoading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">Calculating score…</div>
      ) : scoreError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="h-8 w-8 text-red-400" />
          <p className="text-sm">Couldn't load compliance score.</p>
          <button
            onClick={() => refetchScore()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Overall score + trend */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 shrink-0">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-6 lg:col-span-1">
              <ScoreGauge score={scoreData?.overall ?? null} size={200} />
              <p className="mt-2 text-xs text-slate-500">
                {scoreData?.calculatedAt
                  ? `Calculated ${new Date(scoreData.calculatedAt).toLocaleTimeString()}`
                  : 'Real-time score'}
              </p>
            </div>

            {/* Trend */}
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Score Trend</h2>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
                  {TREND_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => setTrendDays(opt.days)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        trendDays === opt.days ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {trendLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
              ) : (
                <ScoreTrendChart data={trendData} height={200} />
              )}
              <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 bg-green-500 inline-block rounded" /> ≥80% Strong</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 bg-amber-500 inline-block rounded" /> ≥60% Adequate</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 bg-red-500 inline-block rounded" /> &lt;60% At Risk</span>
              </div>
            </div>
          </div>

          {/* Per-framework scores */}
          {frameworks.length > 0 && (
            <div className="shrink-0">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Framework Breakdown</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {frameworks.map((fw) => (
                  <FrameworkScoreCard key={fw.frameworkId} framework={fw} />
                ))}
              </div>
            </div>
          )}

          {frameworks.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
              No frameworks with controls found. Add controls to see scoring.
            </div>
          )}
        </>
      )}
    </div>
  );
}
