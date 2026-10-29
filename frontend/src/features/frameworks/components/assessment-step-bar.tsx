import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useImplementation, workspaceSteps } from '../implementation';

/** Which assessment step each register serves when it is opened from an assessment. */
const STEP_FOR_PAGE: Record<string, string> = {
  '/risks': 'risk_assessment',
  '/controls': 'controls',
  '/policies': 'policies',
  '/policy-templates': 'policies',
  '/evidence': 'evidence',
  '/tasks': 'corrective_actions',
  '/audits': 'internal_audit',
  '/reports': 'outcome',
  '/expiry': 'monitoring',
};

/** A slim bar on a register opened from an assessment: which step this is, and the way back and on. */
export function AssessmentStepBar(): JSX.Element | null {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const frameworkId = params.get('frameworkId') ?? '';
  const stepKey = STEP_FOR_PAGE[pathname];
  const { data } = useImplementation(stepKey ? frameworkId : '');
  if (!stepKey || !frameworkId || !data) return null;
  const steps = workspaceSteps(data);
  const at = steps.findIndex(s => s.key === stepKey);
  if (at < 0) return null;
  const next = steps[at + 1];
  const workspace = (key: string) => `/frameworks?framework=${frameworkId}&step=${key}`;
  return (
    <nav aria-label="Assessment step" className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-7xl flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm sm:w-[calc(100%-3rem)]">
      <p className="min-w-0 text-brand-900">
        <span className="font-semibold">{data.framework.short_name || data.framework.name}</span>
        <span className="mx-2 text-brand-300" aria-hidden="true">|</span>
        Step {at + 1} of {steps.length}: <span className="font-semibold">{steps[at].title}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={workspace(stepKey)} className="inline-flex items-center gap-1 font-semibold text-brand-800 underline"><ArrowLeft className="h-3.5 w-3.5" />Back to assessment</Link>
        {next && <Link to={workspace(next.key)} className="inline-flex items-center gap-1 font-semibold text-brand-800 underline">Next: {next.title}<ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
    </nav>
  );
}
