import { ModalSurface } from '@/components/modal-surface';
import { PermissionAction } from '@/components/permission-action';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { parseISO, isPast } from 'date-fns';
import {
  Plus, Search, FileText, MoreHorizontal, Pencil, Trash2, Send,
  AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePolicies, useDeletePolicy, usePublishPolicy, useApprovePolicy } from '../hooks/use-policies';
import { PolicyFormModal } from '../components/policy-form-modal';
import type { Policy, PolicyStatus } from '../types/policies.types';
import { DOCUMENT_TYPE_CONFIG, POLICY_STATUS_CONFIG } from '../types/policies.types';
import { useOrgFormat } from '@/lib/org-format';
import { SkeletonTable } from '@/components/ui';

const PAGE_SIZE = 20;

export function PoliciesPage(): JSX.Element {
  const [routeParams]=useSearchParams();
  const user=useAuthStore(s=>s.user);
  const role=useAuthStore(s=>s.activeTenant?.role);
  const canWrite=['owner','admin','compliance_manager','msp_admin'].includes(role??'');
  const {mutate:approvePolicy}=useApprovePolicy();

  const fmt = useOrgFormat();
  const [search, setSearch] = useState(routeParams.get('q')??'');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | ''>('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | undefined>();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = usePolicies({
    frameworkId:routeParams.get('frameworkId')||undefined,
    q: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { mutate: deletePolicy, isPending: isDeleting } = useDeletePolicy();
  const { mutate: publishPolicy } = usePublishPolicy();

  const policies = data?.policies ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditingPolicy(undefined);
    setModalOpen(true);
  }

  function openEdit(policy: Policy) {
    setEditingPolicy(policy);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    deletePolicy(id, { onSuccess: () => setConfirmDeleteId(null) });
  }

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Policies</h1><Link className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline" to={routeParams.get('frameworkId')?`/policy-templates?frameworkId=${routeParams.get('frameworkId')}`:'/policy-templates'}>Browse policy templates and Word downloads</Link>
            <p className="mt-1 text-sm text-slate-500">
              Author, review and publish the policies and procedures that govern your organization.
            </p>
          </div>
          <PermissionAction scope="policies:write"><button
            onClick={openCreate}
            disabled={!canWrite}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Policy
          </button></PermissionAction>
        </div>

        <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950">Draft → independent approval → publication → scheduled review. A changed approved policy returns to draft. <Link className="font-semibold underline" to={routeParams.get('frameworkId')?`/frameworks?framework=${routeParams.get('frameworkId')}`:'/frameworks'}>Return to compliance assessment</Link></div>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search policies..."
              value={search}
              onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
              className="w-full max-w-xs rounded-md border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
             aria-label="Search policies..." />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value as PolicyStatus | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
           aria-label="Filter: All Statuses" >
            <option value="">All Statuses</option>
            {Object.entries(POLICY_STATUS_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
          {isLoading ? (
            <SkeletonTable rows={8} columns={7} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : policies.length === 0 ? (
            <EmptyState onAdd={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Title</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Type</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Owner</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Review due</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Version</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map((policy) => {
                  const typeCfg = DOCUMENT_TYPE_CONFIG[policy.documentType];
                  const statusCfg = POLICY_STATUS_CONFIG[policy.status];
                  const isOverdue =
                    policy.reviewDueDate &&
                    isPast(parseISO(policy.reviewDueDate)) &&
                    policy.status !== 'archived';
                  return (
                    <tr key={policy.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-medium text-slate-900">{policy.title}</div>
                        {policy.tags.length > 0 && (
                          <div className="text-xs text-slate-400">{policy.tags.join(', ')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', typeCfg.bgColor, typeCfg.color)}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.bgColor, statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {policy.ownerName ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className={cn('px-6 py-4', isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600')}>
                        {policy.reviewDueDate ? (
                          <div className="flex items-center gap-1">
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                            {fmt.formatDateMedium(policy.reviewDueDate)}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">v{policy.currentVersion}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === policy.id ? null : policy.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            aria-label="Policy actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuOpenId === policy.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                              <PermissionAction scope="policies:write"><button
                                onClick={() => { openEdit(policy); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" /> {canWrite?'Edit':'View'}
                              </button></PermissionAction>
                              {canWrite&&policy.status==='in_review'&&policy.ownerId!==user?.id&&policy.createdBy!==user?.id&&policy.updatedBy!==user?.id&&<button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-indigo-700 hover:bg-slate-50" onClick={()=>{approvePolicy(policy.id);setMenuOpenId(null);}}>Approve policy</button>}
                              {canWrite&&policy.status === 'approved' && (
                                <button
                                  onClick={() => { publishPolicy(policy.id); setMenuOpenId(null); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Send className="h-4 w-4" /> Publish
                                </button>
                              )}
                              <PermissionAction scope="policies:delete"><button
                                onClick={() => { setConfirmDeleteId(policy.id); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button></PermissionAction>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !isError && policies.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + policies.length} of {total} policies
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Policy form modal */}
      <PolicyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        policy={editingPolicy}
        initialFrameworkId={routeParams.get('frameworkId')||undefined}
      />

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <ModalSurface label="Delete Policy?" onClose={() => setConfirmDeleteId(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Policy?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete the policy. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <PermissionAction scope="policies:delete"><button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button></PermissionAction>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalSurface>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangle className="h-7 w-7 text-rose-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Couldn't load policies</h3>
      <p className="mt-1 text-sm text-slate-500">
        Something went wrong while fetching policies.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
        <FileText className="h-7 w-7 text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">No policies yet</h3>
      <p className="mt-1 text-sm text-slate-500">
        Create your first policy to start documenting how your organization stays compliant.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> New Policy
      </button>
    </div>
  );
}
