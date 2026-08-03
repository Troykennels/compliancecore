import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ScoreTrendPoint } from '../types/score.types';
import { useOrgFormat } from '@/lib/org-format';

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className="font-bold text-slate-900">{score !== null && score !== undefined ? `${score}%` : 'N/A'}</p>
    </div>
  );
}

export function ScoreTrendChart({ data, height = 220 }: ScoreTrendChartProps) {
  const fmt = useOrgFormat();
  const chartData = data.map((d) => ({
    date:  fmt.formatDateShort(d.date),
    score: d.score !== null ? Math.round(d.score * 100) / 100 : null,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        No trend data yet — snapshots are taken daily.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={80} stroke="#22C55E" strokeDasharray="4 4" strokeWidth={1} />
        <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#3B82F6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#3B82F6' }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
