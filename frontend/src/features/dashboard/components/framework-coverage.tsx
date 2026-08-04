import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Library } from 'lucide-react';
import type { FrameworkScore } from '../../compliance-score/types/score.types';
import { CHART, scoreBand, scoreColor } from '@/lib/chart-theme';

interface FrameworkCoverageProps {
  frameworks: FrameworkScore[];
}

interface TooltipDatum {
  name: string;
  fullName: string;
  score: number | null;
  total: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TooltipDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {/* The axis label is truncated to fit; the tooltip is where the full
          framework name belongs. */}
      <p className="mb-1 font-semibold text-slate-900">{d.fullName}</p>
      <p className="text-slate-600">
        Score{' '}
        <span data-numeric className="font-semibold text-slate-900">
          {d.score !== null ? `${d.score}%` : 'Not scored'}
        </span>
        {d.score !== null && <span className="ml-1.5 text-slate-400">{scoreBand(d.score)}</span>}
      </p>
      <p className="text-slate-500">{d.total} controls</p>
    </div>
  );
}

export function FrameworkCoverage({ frameworks }: FrameworkCoverageProps) {
  if (frameworks.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center text-center">
        <Library className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p className="text-xs font-medium text-slate-600">No frameworks adopted</p>
        <p className="mt-0.5 text-2xs text-slate-400">
          Adopt a framework to see coverage by standard.
        </p>
      </div>
    );
  }

  const data: TooltipDatum[] = frameworks.map((fw) => {
    // frameworkName is null for the "unmapped" bucket (controls with no
    // framework). Guard it — reading .length on null crashes the whole page.
    const name = fw.frameworkName ?? 'Unmapped';
    return {
      name: name.length > 14 ? name.slice(0, 12) + '…' : name,
      fullName: name,
      score: fw.score !== null ? Math.round(fw.score) : null,
      total: fw.controlCounts?.total ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={20}>
        <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.cursor }} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
          {data.map((d, i) => (
            <Cell key={i} fill={scoreColor(d.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
