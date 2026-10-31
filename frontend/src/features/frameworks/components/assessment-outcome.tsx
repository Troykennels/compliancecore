import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import { useImplementationAction, type Implementation } from '../implementation';
import { evidenceApi } from '@/features/evidence/api/evidence.api';
import {
  AssessmentField as Field,
  assessmentInput as input,
  assessmentButton as button,
} from './assessment-records';

export function AssessmentOutcome({ assessment: s }: { assessment: Implementation }) {
  const role = useAuthStore((state) => state.activeTenant?.role);
  const userId = useAuthStore((state) => state.user?.id);
  const manager = ['owner', 'admin', 'compliance_manager', 'msp_admin'].includes(role ?? '');
  const outcome = s.outcome;
  const [kind, setKind] = useState(outcome?.kind ?? 'recorded');
  useEffect(() => setKind(outcome?.kind ?? 'recorded'), [outcome?.kind]);
  const fmt = useOrgFormat();
  const action = useImplementationAction(s.framework.id);
  const files = useQuery({
    queryKey: ['assessment-outcome-files'],
    enabled: manager,
    queryFn: () =>
      evidenceApi.list({ status: 'active', limit: 100 }).then((r) => r.data.data.evidence),
  });
  const canReview =
    outcome &&
    !s.outcomeCurrent &&
    ['owner', 'admin', 'compliance_manager', 'auditor', 'msp_admin'].includes(role ?? '') &&
    userId !== outcome.recorded_by &&
    userId !== s.plan?.owner_id &&
    userId !== s.plan?.submitted_by;
  return (
    <section
      className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      aria-label="Recorded assessment outcome"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Record the final outcome</h2>
        {s.outcomeCurrent ? (
          <CheckCircle2 className="h-5 w-5 text-brand-700" />
        ) : (
          <Clock className="h-5 w-5 text-slate-400" />
        )}
      </div>
      <p className="text-sm text-slate-500">
        Retain the actual issued report, filing acknowledgment or certificate. A different reviewer
        confirms the record. The next review date creates a calendar follow-up after approval.
      </p>
      {s.status !== 'implemented' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Finish the assessment and independent sign-off before recording its outcome.
        </p>
      )}
      {outcome && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold">
            {s.outcomeCurrent ? 'Outcome reviewed and current' : 'Outcome needs review or updating'}
          </p>
          <p>
            {outcome.kind === 'not_sought'
              ? 'Optional certification not sought'
              : outcome.authority}{' '}
            · {outcome.reference}
          </p>
          <p>
            Issued {fmt.formatDate(outcome.issued_on)} · Next review{' '}
            {fmt.formatDate(outcome.next_review_on)}
          </p>
          <p className="whitespace-pre-wrap text-slate-600">{outcome.note}</p>
          {outcome.evidence_id && (
            <Link
              to={`/evidence/${outcome.evidence_id}`}
              className="inline-block font-semibold text-brand-700 underline"
            >
              Open supporting document
            </Link>
          )}
        </div>
      )}
      {manager && (
        <details open={!outcome}>
          <summary className="cursor-pointer text-sm font-semibold">
            {outcome ? 'Update outcome record' : 'Enter outcome details'}
          </summary>
          <form
            key={JSON.stringify(outcome)}
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const v = Object.fromEntries(new FormData(event.currentTarget).entries());
              action.mutate({
                method: 'put',
                path: '/outcome',
                data: {
                  ...v,
                  evidenceId: kind === 'recorded' ? v.evidenceId : null,
                  validUntil: v.validUntil || null,
                },
              });
            }}
          >
            <fieldset
              disabled={action.isPending || s.status !== 'implemented'}
              className="contents"
            >
              <Field label="Outcome type">
                <select
                  name="kind"
                  className={input}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="recorded">Issued report, filing or certificate</option>
                  {s.profile.outcome === 'certification' && (
                    <option value="not_sought">Optional certification not sought</option>
                  )}
                </select>
              </Field>
              <Field
                label={
                  kind === 'not_sought'
                    ? 'Responsible management authority'
                    : 'Issuing body or reporting authority'
                }
              >
                <input
                  name="authority"
                  minLength={2}
                  maxLength={500}
                  required
                  defaultValue={outcome?.authority}
                  className={input}
                />
              </Field>
              <Field label="Document or decision reference">
                <input
                  name="reference"
                  minLength={2}
                  maxLength={500}
                  required
                  defaultValue={outcome?.reference}
                  className={input}
                />
              </Field>
              <Field label="Issue or decision date">
                <input
                  name="issuedOn"
                  type="date"
                  required
                  defaultValue={outcome?.issued_on.slice(0, 10)}
                  className={input}
                />
              </Field>
              <Field label="Next review date">
                <input
                  name="nextReviewOn"
                  type="date"
                  required
                  defaultValue={outcome?.next_review_on.slice(0, 10)}
                  className={input}
                />
              </Field>
              <Field label="Valid until, if applicable">
                <input
                  name="validUntil"
                  type="date"
                  defaultValue={outcome?.valid_until?.slice(0, 10)}
                  className={input}
                />
              </Field>
              {kind === 'recorded' && (
                <Field label="Supporting evidence document">
                  <select
                    name="evidenceId"
                    required
                    defaultValue={outcome?.evidence_id ?? ''}
                    className={input}
                  >
                    <option value="">Choose a completed upload</option>
                    {files.data
                      ?.filter((f) => f.currentVersionId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title} · v{f.currentVersionNumber}
                        </option>
                      ))}
                  </select>
                  {files.isError && (
                    <button
                      type="button"
                      onClick={() => void files.refetch()}
                      className="mt-1 text-xs underline"
                    >
                      Retry evidence list
                    </button>
                  )}
                </Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Outcome, scope, outstanding conditions and rationale">
                  <textarea
                    name="note"
                    minLength={30}
                    maxLength={10000}
                    rows={4}
                    required
                    defaultValue={outcome?.note}
                    className={input}
                  />
                </Field>
              </div>
              <button className={button} disabled={action.isPending || s.status !== 'implemented'}>
                Save for independent review
              </button>
            </fieldset>
          </form>
        </details>
      )}
      {canReview && (
        <form
          className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.mutate({ path: '/outcome/review' });
          }}
        >
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required className="mt-1" />I checked the outcome reference,
            scope, evidence and next review date.
          </label>
          <button className={button} disabled={action.isPending || s.status !== 'implemented'}>
            Confirm reviewed outcome
          </button>
        </form>
      )}
    </section>
  );
}
