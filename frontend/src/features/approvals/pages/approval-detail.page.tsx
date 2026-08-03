import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, FileSignature } from 'lucide-react';
import { PATHS } from '@/routes/paths';
import { useApprovalRequest, useMyPendingApprovals, useCancelApproval } from '../hooks/use-approvals';
import { ApprovalTimeline } from '../components/approval-timeline';
import { ApprovalDecisionModal } from '../components/approval-decision-modal';
import type { ApprovalStatus, ApprovalRequestStep } from '../types/approvals.types';
import { useOrgFormat } from '@/lib/org-format';

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; icon: React.ReactNode; className: string }> = {
  draft:             { label: 'Draft',             icon: <Clock className="h-4 w-4" />,        className: 'bg-slate-100 text-slate-700' },
  pending:           { label: 'Pending',           icon: <Clock className="h-4 w-4" />,        className: 'bg-amber-100 text-amber-700' },
  approved:          { label: 'Approved',          icon: <CheckCircle className="h-4 w-4" />, className: 'bg-green-100 text-green-700' },
  rejected:          { label: 'Rejected',          icon: <XCircle className="h-4 w-4" />,     className: 'bg-red-100 text-red-700' },
  cancelled:         { label: 'Cancelled',         icon: <XCircle className="h-4 w-4" />,     className: 'bg-slate-100 text-slate-500' },
  withdrawn:         { label: 'Withdrawn',         icon: <XCircle className="h-4 w-4" />,     className: 'bg-slate-100 text-slate-500' },
  changes_requested: { label: 'Changes Requested', icon: <AlertCircle className="h-4 w-4" />, className: 'bg-orange-100 text-orange-700' },
};

export function ApprovalDetailPage() {
  const fmt = useOrgFormat();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [decideStep, setDecideStep] = useState<ApprovalRequestStep | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: request, isLoading } = useApprovalRequest(id!);
  const { data: myPending = [] } = useMyPendingApprovals();
  const cancelMutation = useCancelApproval();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Approval request not found.</p>
        <Link to={PATHS.APPROVALS} className="mt-2 text-sm text-blue-600 hover:underline">Back to Approvals</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[request.status as ApprovalStatus] ?? STATUS_CONFIG.pending;
  const isPending = request.status === 'pending' || request.status === 'draft';

  // Find which active step the current user can act on
  const myPendingIds = new Set(myPending.map((r: any) => r.id));
  const canIDecide = myPendingIds.has(request.id);
  const activeStep = request.steps?.find((s: ApprovalRequestStep) => s.status === 'active');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(PATHS.APPROVALS)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Approvals
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{request.title}</h1>
            {request.description && (
              <p className="text-sm text-slate-600 mt-1">{request.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusCfg.className}`}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
            {isPending && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: timeline */}
        <div className="col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Approval Progress</h2>
            {(request.steps?.length ?? 0) > 0 ? (
              <ApprovalTimeline steps={request.steps ?? []} currentStep={request.currentStep} />
            ) : (
              <p className="text-sm text-slate-400">No steps defined.</p>
            )}

            {canIDecide && activeStep && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setDecideStep(activeStep)}
                  className="flex items-center gap-2 w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FileSignature className="h-4 w-4" />
                  Record My Decision — {activeStep.name}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</h3>
            <dl className="space-y-2.5">
              <MetaRow label="Priority">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  request.priority === 'critical' ? 'bg-red-50 text-red-700' :
                  request.priority === 'high'     ? 'bg-orange-50 text-orange-700' :
                  request.priority === 'medium'   ? 'bg-blue-50 text-blue-700' :
                                                    'bg-slate-50 text-slate-600'
                }`}>
                  {request.priority}
                </span>
              </MetaRow>
              <MetaRow label="Entity Type">
                <span className="text-xs text-slate-700 capitalize">{request.entityType ?? '—'}</span>
              </MetaRow>
              {request.requesterName && (
                <MetaRow label="Requested By">
                  <span className="text-xs text-slate-700">{request.requesterName}</span>
                </MetaRow>
              )}
              {request.createdAt && (
                <MetaRow label="Submitted">
                  <span className="text-xs text-slate-700">{fmt.formatDateTimeMedium(request.createdAt)}</span>
                </MetaRow>
              )}
              {request.deadline && (
                <MetaRow label="Deadline">
                  <span className="text-xs text-red-600 font-medium">{fmt.formatDateTimeMedium(request.deadline)}</span>
                </MetaRow>
              )}
              {request.completedAt && (
                <MetaRow label="Completed">
                  <span className="text-xs text-slate-700">{fmt.formatDateTimeMedium(request.completedAt)}</span>
                </MetaRow>
              )}
              <MetaRow label="Progress">
                <span className="text-xs text-slate-700">Step {Math.min((request.currentStep ?? 0) + 1, request.totalSteps ?? 1)} of {request.totalSteps ?? 1}</span>
              </MetaRow>
            </dl>
          </div>

          {request.workflowId && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] text-slate-400 uppercase font-semibold mb-1">Workflow Template</p>
              <p className="text-xs text-slate-700">{request.workflowName ?? 'Custom workflow'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirm */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-80">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Cancel this request?</h3>
            <p className="text-xs text-slate-600 mb-4">All pending approvers will be notified. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelConfirm(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Keep</button>
              <button
                onClick={async () => {
                  await cancelMutation.mutateAsync({ id: request.id });
                  setCancelConfirm(false);
                  navigate(PATHS.APPROVALS);
                }}
                disabled={cancelMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision modal */}
      {decideStep && (
        <ApprovalDecisionModal
          open={true}
          onClose={() => setDecideStep(null)}
          requestId={request.id}
          step={decideStep}
        />
      )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
