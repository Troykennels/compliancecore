import { PageHeader, CountChips } from '@/components/page-header';

/** Assessment pages use the shared page header. */
export const AssessmentHeader = PageHeader;
export { CountChips };

/** Status pill used in headers and tables. */
export function StatusBadge({ status, label }: { status: string; label: string }): JSX.Element {
  const tone =
    status === 'implemented'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'needs_attention'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : ['in_review', 'ready_for_review'].includes(status)
          ? 'bg-sky-50 text-sky-900 border-sky-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

/** Bordered pill bar for the assessment phases. The current phase is filled. */
export function PhaseTabs({
  phases,
  current,
  onChange,
}: {
  phases: Array<{ key: string; label: string; done: number; total: number }>;
  current: string;
  onChange: (key: string) => void;
}): JSX.Element {
  return (
    <nav aria-label="Assessment phases" className="cc-phase-track">
      {phases.map((p, index) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          aria-current={p.key === current ? 'step' : undefined}
        >
          <span className="cc-phase-number">{p.done === p.total ? '✓' : index + 1}</span>
          <span>
            <strong>{p.label}</strong>
            <small>
              {p.done} of {p.total} steps complete
            </small>
          </span>
        </button>
      ))}
    </nav>
  );
}
