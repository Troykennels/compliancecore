import { useId } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { ScoreTrendPoint } from '../types/score.types';
import { useOrgFormat } from '@/lib/org-format';
import { CHART } from '@/lib/chart-theme';

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number | null }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 text-slate-500">{label}</p>
      <p data-numeric className="text-sm font-semibold text-slate-900">
        {score !== null && score !== undefined ? `${score}%` : 'Not scored'}
      </p>
    </div>
  );
}

/**
 * Compliance score over time.
 *
 * Switched from a bare line to an area: the filled region gives the trend
 * visual weight at dashboard size, where a 2px line on a 172px canvas reads as
 * a thin scratch. The two reference lines are now labelled — an unexplained
 * dashed rule is decoration, but "Target 80%" tells the reader whether the
 * curve is where it should be, which is the entire question they came with.
 */
export function ScoreTrendChart({ data, height = 220 }: ScoreTrendChartProps) {
  const fmt = useOrgFormat();
  const gradientId = useId();

  const chartData = data.map((d) => ({
    date:  fmt.formatDateShort(d.date),
    score: d.score !== null ? Math.round(d.score * 100) / 100 : null,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ height }}>
        <TrendingUp className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p className="text-xs font-medium text-slate-600">No trend yet</p>
        <p className="mt-0.5 max-w-[18rem] text-2xs text-slate-400">
          A snapshot is taken daily. Your first points appear tomorrow, and the
          line becomes meaningful after a week or so.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 6, right: 44, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal rules only. Vertical grid lines add noise to a time series
            that already has dated ticks. */}
        <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART.track, strokeWidth: 1 }} />

        <ReferenceLine y={80} stroke={CHART.success} strokeDasharray="4 4" strokeWidth={1}>
          <Label value="Target 80%" position="right" fontSize={10} fill={CHART.success} />
        </ReferenceLine>
        <ReferenceLine y={60} stroke={CHART.warning} strokeDasharray="4 4" strokeWidth={1}>
          <Label value="Minimum 60%" position="right" fontSize={10} fill={CHART.warning} />
        </ReferenceLine>

        <Area
          type="monotone"
          dataKey="score"
          stroke={CHART.brand}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: CHART.brand, stroke: CHART.surface, strokeWidth: 2 }}
          connectNulls
          isAnimationActive
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
