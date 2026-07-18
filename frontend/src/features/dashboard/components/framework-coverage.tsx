import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { FrameworkScore } from '../../compliance-score/types/score.types';

interface FrameworkCoverageProps {
  frameworks: FrameworkScore[];
}

function barColor(score: number | null): string {
  if (score === null) return '#CBD5E1';
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-900 mb-1">{d.name}</p>
      <p className="text-slate-600">Score: <span className="font-bold">{d.score !== null ? `${d.score}%` : 'N/A'}</span></p>
      <p className="text-slate-500">{d.total} controls</p>
    </div>
  );
}

export function FrameworkCoverage({ frameworks }: FrameworkCoverageProps) {
  if (frameworks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No framework data yet.
      </div>
    );
  }

  const data = frameworks.map((fw) => {
    // frameworkName is null for the "unmapped" bucket (controls with no
    // framework). Guard it — reading .length on null crashes the whole page.
    const name = fw.frameworkName ?? 'Unmapped';
    return {
      name:  name.length > 14 ? name.slice(0, 12) + '…' : name,
      score: fw.score !== null ? Math.round(fw.score) : null,
      total: fw.controlCounts?.total ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(d.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
