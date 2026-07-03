import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, GitBranch, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import {
  useApprovalRequests,
  useMyPendingApprovals,
  useWorkflows,
  useCancelApproval,
  useDeleteWorkflow,
} from '../hooks/use-approvals';
import { ApprovalRequestModal } from '../components/approval-request-modal';
import { WorkflowBuilder } from '../components/workflow-builder';
import type { ApprovalStatus } from '../types/approvals.types';

const STATUS_ICON: Record<ApprovalStatus, React.ReactNode> = {
  draft:              <Clock className="h-4 w-4 text-slate-400" />,
  pending:            <Clock className="h-4 w-4 text-amber-500" />,
  approved:           <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected:           <XCircle className="h-4 w-4 text-red-500" />,
  cancelled:          <XCircle className="h-4 w-4 text-slate-400" />,
  withdrawn:          <XCircle className="h-4 w-4 text-slate-400" />,
  changes_requested:  <AlertCircle className="h-4 w-4 text-orange-500" />,
};

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  draft:             'bg-slate-100 text-slate-600',
  pending:           'bg-amber-100 text-amber-700',
  approved:          'bg-green-100 text-green-700',
  rejected:          'bg-red-100 text-red-700',
  cancelled:         'bg-slate-100 text-slate-500',
  withdrawn:         'bg-slate-100 text-slate-500',
  changes_requested: 'bg-orange-100 text-orange-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border border-red-200',
  high:     'bg-orange-50 text-orange-700 border border-orange-200',
  medium:   'bg-blue-50 text-blue-700 border border-blue-200',
  low:      'bg-slate-50 text-slate-600 border border-slate-200',
};

type Tab = 'my-pending' | 'all' | 'workflows';

export function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('my-pending');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: myPending = [], isLoading: pendingLoading } = useMyPendingApprovals();
  const { data: allRequests, isLoading: allLoading } = useApprovalRequests(
    statusFilter ? { status: statusFilter as ApprovalStatus } : {}
  );
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows();

  const cancelMutation = useCancelApproval();
  const deleteWorkflow = useDeleteWorkflow();

  const confirmCancel = async () => {
    if (!cancelId) return;
    await cancelMutation.mutateAsync({ id: cancelId });
    setCancelId(null);
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'my-pending', label: 'My Pending', count: myPending.length },
    { key: 'all',        label: 'All Requests' },
    { key: 'workflows',  label: 'Workflows', count: workflows.length },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Approval Workflows</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage multi-step approval requests and workflow templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWorkflowBuilder(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <GitBranch className="h-4 w-4" /> New Workflow
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Request
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Pending */}
      {tab === 'my-pending' && (
        <div>
          {pendingLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : myPending.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 text-center">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">All caught up</p>
              <p className="text-xs text-slate-400 mt-1">No pending approvals require your attention</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myPending.map((req) => (
                <RequestCard key={req.id} req={req} onCancel={setCancelId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Requests */}
      {tab === 'all' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {allLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : !allRequests?.items?.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <p className="text-sm text-slate-500">No approval requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allRequests.items.map((req: any) => (
                <RequestCard key={req.id} req={req} onCancel={setCancelId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Workflows */}
      {tab === 'workflows' && (
        <div>
          {wfLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : workflows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <GitBranch className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No workflow templates yet</p>
              <button onClick={() => setShowWorkflowBuilder(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                Create your first workflow
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Entity Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Steps</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workflows.map((wf: any) => (
                    <tr key={wf.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{wf.name}</td>
                      <td className="px-4 py-3 text-slate-600">{wf.entityType ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{wf.steps?.length ?? 0} steps</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${wf.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {wf.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {wf.createdAt ? format(parseISO(wf.createdAt), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (confirm(`Delete workflow "${wf.name}"? This cannot be undone.`)) {
                              deleteWorkflow.mutate(wf.id);
                            }
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete workflow"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirm */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-80">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Cancel Request?</h3>
            <p className="text-xs text-slate-600 mb-4">This action cannot be undone. The request will be marked as cancelled.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelId(null)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Keep</button>
              <button onClick={confirmCancel} disabled={cancelMutation.isPending} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ApprovalRequestModal open={showRequestModal} onClose={() => setShowRequestModal(false)} />
      <WorkflowBuilder open={showWorkflowBuilder} onClose={() => setShowWorkflowBuilder(false)} />
    </div>
  );
}

function RequestCard({ req, onCancel }: { req: any; onCancel: (id: string) => void }) {
  const canCancel = req.status === 'pending' || req.status === 'draft';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{STATUS_ICON[req.status as ApprovalStatus]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{req.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {req.entityType} {req.requesterName && `· Requested by ${req.requesterName}`}
                {req.createdAt && ` · ${format(parseISO(req.createdAt), 'MMM d, yyyy')}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[req.status as ApprovalStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                {req.status.replace('_', ' ')}
              </span>
              {req.priority && (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_BADGE[req.priority] ?? ''}`}>
                  {req.priority}
                </span>
              )}
            </div>
          </div>

          {req.totalSteps > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Step {Math.min((req.currentStep ?? 0) + 1, req.totalSteps)} of {req.totalSteps}</span>
                <span>{Math.round(((req.currentStep ?? 0) / req.totalSteps) * 100)}% complete</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round(((req.currentStep ?? 0) / req.totalSteps) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            to={PATHS.APPROVAL_DETAIL(req.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {canCancel && (
            <button
              onClick={() => onCancel(req.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Cancel request"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
