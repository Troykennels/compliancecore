import type { ReactNode } from 'react';

/** The one page header used across the app: eyebrow (menu group), title, facts, purpose and actions in one bordered card. */
export function PageHeader({ eyebrow, title, description, meta, actions, children }: {
  eyebrow: string; title: string; description?: ReactNode; meta?: ReactNode[]; actions?: ReactNode; children?: ReactNode;
}): JSX.Element {
  return (
    <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
        {meta && meta.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
            {meta.map((m, i) => <span key={i} className="inline-flex items-center">{m}</span>)}
          </p>
        )}
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

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
