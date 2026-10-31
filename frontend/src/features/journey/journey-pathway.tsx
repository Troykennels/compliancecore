import type { CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { PHASES, phaseOf } from '@/features/frameworks/assessment-phases';
import {
  implementationLabels,
  workspaceSteps,
  type Implementation,
} from '@/features/frameworks/implementation';

/** Saved compliance steps, grouped for scanning without hiding any required work. */
export function JourneyPathway({
  assessments,
  loading,
  error,
  retry,
}: {
  assessments: Implementation[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const current =
    assessments.find((a) => a.framework.id === params.get('framework')) ??
    assessments.find((a) => a.status !== 'implemented') ??
    assessments[0];
  const steps = current ? workspaceSteps(current) : [];
  const keys = steps.map((step) => step.key);
  const next = steps.findIndex((step) => !step.done);
  const done = steps.filter((step) => step.done).length;
  const phases = PHASES.map((phase) => ({
    ...phase,
    items: steps.filter((step) => phaseOf(keys, step.key) === phase.key),
  })).filter((phase) => phase.items.length);
  const phaseKey = params.get('phase') ?? phaseOf(keys, steps[Math.max(next, 0)]?.key ?? 'scope');
  const selected = phases.find((phase) => phase.key === phaseKey) ?? phases[0];
  const update = (key: string, value: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set(key, value);
    if (key === 'framework') nextParams.delete('phase');
    setParams(nextParams);
  };
  const stepUrl = (key: string) => `/frameworks?framework=${current.framework.id}&step=${key}`;
  if (loading)
    return (
      <section className="cc-context-card" role="status">
        Loading saved assessment progress…
      </section>
    );
  if (error)
    return (
      <section className="cc-context-card">
        <p>Assessment progress could not be loaded.</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry assessment progress
        </button>
      </section>
    );
  if (!current)
    return (
      <section className="cc-context-card">
        <h2>Start your compliance assessment</h2>
        <p>
          Confirm the organisation, its activities and applicable requirements. The saved assessment
          sequence will appear here.
        </p>
        <Link
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
          to="/frameworks"
        >
          Open assessments <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Your assessment pathway</h2>
          <p className="mt-1 text-xs text-slate-500">
            Follow the recorded steps, review the evidence and return to the work that needs
            attention.
          </p>
        </div>
        <label className="text-xs font-semibold text-slate-600">
          Assessment
          <select
            className="ml-3 rounded-md border bg-white px-3 py-2 text-xs"
            value={current.framework.id}
            onChange={(event) => update('framework', event.target.value)}
          >
            {assessments.map((assessment) => (
              <option key={assessment.framework.id} value={assessment.framework.id}>
                {assessment.framework.short_name || assessment.framework.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="cc-phase-track" aria-label="Compliance journey phases">
        {phases.map((phase, index) => (
          <button
            type="button"
            key={phase.key}
            onClick={() => update('phase', phase.key)}
            aria-current={selected?.key === phase.key ? 'step' : undefined}
          >
            <span className="cc-phase-number">
              {phase.items.every((step) => step.done) ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </span>
            <span>
              <strong>{phase.label}</strong>
              <small>
                {phase.items.filter((step) => step.done).length} of {phase.items.length} steps
                complete
              </small>
            </span>
          </button>
        ))}
      </nav>
      {next >= 0 && (
        <Link
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
          to={stepUrl(steps[next].key)}
        >
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Your next action · step {next + 1}
            </span>
            <span className="text-xs font-semibold">{steps[next].title}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}
      <div className="cc-journey-grid">
        <section className="cc-context-card" aria-labelledby="journey-phase-title">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 id="journey-phase-title" className="!mb-1 !text-sm">
                {selected?.label}
              </h2>
              <p className="text-slate-500">Each step opens its saved assessment records.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
              {selected?.items.length} steps
            </span>
          </div>
          <ol>
            {selected?.items.map((step) => (
              <li className="cc-journey-step" key={step.key}>
                <span>
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  ) : (
                    steps.findIndex((item) => item.key === step.key) + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{step.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${step.done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {step.done ? 'Records complete' : 'Work remaining'}
                    </span>
                  </div>
                  <p>{step.detail}</p>
                  <Link to={stepUrl(step.key)}>
                    {step.done ? 'Review saved work' : 'Open step'}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
          <details className="mt-3 border-t border-slate-200 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-brand-700">
              View every assessment step ({steps.length})
            </summary>
            <ol className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <li key={step.key}>
                  <Link
                    to={stepUrl(step.key)}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-xs"
                  >
                    <span>
                      {index + 1}. {step.title}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {step.done ? 'Complete' : 'Open'}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        </section>
        <aside className="cc-journey-side" aria-label="Assessment summary">
          <section className="cc-context-card">
            <h2>Progress summary</h2>
            <div className="flex items-center gap-4">
              <div
                className="cc-progress-ring"
                style={
                  {
                    '--cc-progress': `${steps.length ? (100 * done) / steps.length : 0}%`,
                  } as CSSProperties
                }
              >
                <div>
                  <strong>
                    {done}/{steps.length}
                  </strong>
                  <small>steps complete</small>
                </div>
              </div>
              <div className="space-y-2 text-[11px]">
                <p>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-500" />
                  {done} complete
                </p>
                <p>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-200" />
                  {steps.length - done} remaining
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-slate-500">
              {implementationLabels[current.status] ?? current.status}
            </p>
          </section>
          <section className="cc-context-card">
            <h2>Assessment at a glance</h2>
            <dl>
              <dt>Applicable controls</dt>
              <dd>{current.stats.applicable}</dd>
              <dt>With evidence</dt>
              <dd>{current.stats.evidenced}</dd>
              <dt>Without an owner</dt>
              <dd>{current.stats.unassigned}</dd>
              <dt>Overdue</dt>
              <dd>{current.stats.overdue}</dd>
            </dl>
          </section>
          <section className="cc-context-card">
            <h2>Review before concluding</h2>
            <p className="text-slate-600">
              Completed records, independent approval and the final external outcome are separate
              checks. Progress changes when supporting records change.
            </p>
            <Link
              to={stepUrl('signoff')}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
            >
              Open assessment review <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
