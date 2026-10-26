import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card, CardHeader } from '@/components/ui';
import type { ControlCounts } from '../api/dashboard.api';

export function ControlStatusChart({ controls }: { controls: ControlCounts }) {
  const bands = [
    { name: 'Operating', value: controls.implemented, color: '#0a7d58' },
    { name: 'Partly operating', value: controls.partiallyImplemented, color: '#b36405' },
    { name: 'Planned', value: controls.planned, color: '#2470e8' },
    { name: 'Not operating', value: controls.notImplemented, color: '#dc3545' },
    { name: 'Not applicable', value: controls.notApplicable, color: '#8254c7' },
  ];
  const inScope = controls.total - controls.notApplicable;
  const pct = inScope > 0 ? Math.round(100 * controls.implemented / inScope) : null;
  return <Card className="min-w-0">
    <CardHeader title="Control status" description="Which safeguards are recorded as operating?" />
    {!controls.total ? <p className="py-12 text-center text-sm text-slate-500">No controls recorded yet. Start with a compliance assessment.</p> : <>
      <div className="relative mx-auto my-3 h-[190px] max-w-[260px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bands.filter(b => b.value > 0)} dataKey="value" innerRadius={67} outerRadius={88} strokeWidth={3} isAnimationActive={false}>{bands.filter(b => b.value > 0).map(b => <Cell key={b.name} fill={b.color} />)}</Pie></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tabular-nums text-slate-900">{pct === null ? 'N/A' : `${pct}%`}</span><span className="mt-1 text-xs text-slate-500">operating in scope</span></div>
      </div>
      <ul className="space-y-2" aria-label="Control status breakdown">{bands.map(b => <li key={b.name} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} /><span className="flex-1 text-slate-600">{b.name}</span><span className="font-semibold tabular-nums text-slate-900">{b.value}</span></li>)}</ul>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">{pct === null ? 'No applicable controls recorded.' : `${controls.implemented} of ${inScope} applicable controls recorded as operating.`} This measures status, not verified effectiveness.</p>
    </>}
  </Card>;
}
