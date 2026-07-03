import React from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle, XCircle, Clock, SkipForward, AlertCircle, User } from 'lucide-react';
import type { ApprovalRequestStep, ApprovalStepStatus } from '../types/approvals.types';

const STEP_ICON: Record<ApprovalStepStatus, React.ReactNode> = {
  pending:           <Clock className="h-4 w-4 text-slate-400" />,
  active:            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />,
  approved:          <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected:          <XCircle className="h-4 w-4 text-red-500" />,
  skipped:           <SkipForward className="h-4 w-4 text-slate-400" />,
  changes_requested: <AlertCircle className="h-4 w-4 text-orange-500" />,
};

const STEP_BG: Record<ApprovalStepStatus, string> = {
  pending:           'bg-slate-100',
  active:            'bg-amber-50 border-amber-200',
  approved:          'bg-green-50 border-green-200',
  rejected:          'bg-red-50 border-red-200',
  skipped:           'bg-slate-50',
  changes_requested: 'bg-orange-50 border-orange-200',
};

interface ApprovalTimelineProps {
  steps: ApprovalRequestStep[];
  currentStep?: number;
}

export function ApprovalTimeline({ steps }: ApprovalTimelineProps) {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <div className="space-y-0">
      {ordered.map((step, idx) => {
        const isLast = idx === ordered.length - 1;
        const bg = STEP_BG[step.status] ?? 'bg-slate-100';

        return (
          <div key={step.id} className="flex gap-3">
            {/* Connector + icon column */}
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                step.status === 'active' ? 'border-amber-400 bg-white' :
                step.status === 'approved' ? 'border-green-400 bg-green-50' :
                step.status === 'rejected' ? 'border-red-400 bg-red-50' :
                'border-slate-200 bg-white'
              }`}>
                {STEP_ICON[step.status]}
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[16px]" />}
            </div>

            {/* Step card */}
            <div className={`mb-3 flex-1 rounded-xl border px-4 py-3 ${bg}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Step {step.stepOrder}</span>
                    {step.status === 'active' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase">Awaiting</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{step.name}</p>
                </div>
                {step.decision && (
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    step.decision === 'approved' ? 'bg-green-100 text-green-700' :
                    step.decision === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {step.decision.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Assignee */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <User className="h-3.5 w-3.5" />
                {step.assigneeName ?? step.assignedRole ?? 'Unassigned'}
              </div>

              {/* Decision info */}
              {step.decidedBy && (
                <p className="mt-1.5 text-xs text-slate-600">
                  Decided by <span className="font-medium">{step.deciderName ?? step.decidedBy}</span>
                  {step.decidedAt && ` · ${format(parseISO(step.decidedAt), 'MMM d, yyyy h:mm a')}`}
                </p>
              )}

              {step.comments && (
                <div className="mt-2 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-600 italic border border-slate-200">
                  "{step.comments}"
                </div>
              )}

              {step.instructions && !step.decidedBy && (
                <p className="mt-2 text-xs text-slate-500 bg-white/60 rounded px-2 py-1.5 border border-slate-100">
                  <span className="font-medium">Instructions:</span> {step.instructions}
                </p>
              )}

              {step.requireSignature && (
                <p className="mt-1.5 text-[11px] text-blue-600 font-medium">
                  Digital signature required
                  {step.digitalSignatureId ? ' ✓ Signed' : ''}
                </p>
              )}

              {step.deadline && !step.decidedAt && (
                <p className="mt-1 text-[11px] text-red-600">
                  Due {format(parseISO(step.deadline), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
