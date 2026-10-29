import { PageHeader } from './ui/page-header';

/** One header component for the whole app; see components/ui/page-header.tsx. */
export { PageHeader };

/** Small count chips for a summary strip. Warn and good tones are for numbers that need attention or are complete. */
export function CountChips({ items }: { items: Array<{ label: string; value: number | string; tone?: 'neutral' | 'good' | 'warn' }> }): JSX.Element {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map(i => (
        <li key={i.label} className={`rounded-md border px-2.5 py-1 text-xs ${i.tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : i.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          {i.label}: <strong>{i.value}</strong>
        </li>
      ))}
    </ul>
  );
}
