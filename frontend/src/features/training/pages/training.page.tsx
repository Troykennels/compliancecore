import { useState } from 'react';
import {
  Plus, Search, GraduationCap, MoreHorizontal, Pencil, Trash2,
  AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrainings, useDeleteTraining } from '../hooks/use-training';
import { TrainingFormModal } from '../components/training-form-modal';
import type { TrainingProgram, TrainingStatus } from '../types/training.types';
import { TRAINING_STATUS_CONFIG } from '../types/training.types';
import { SkeletonTable } from '@/components/ui';

const PAGE_SIZE = 20;

export function TrainingPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | undefined>();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useTrainings({
    q: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { mutate: deleteTraining, isPending: isDeleting } = useDeleteTraining();

  const programs = data?.programs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditingProgram(undefined);
    setModalOpen(true);
  }

  function openEdit(program: TrainingProgram) {
    setEditingProgram(program);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    deleteTraining(id, { onSuccess: () => setConfirmDeleteId(null) });
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
            <h1 className="text-2xl font-bold text-slate-900">Training</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage training programs and track employee enrollments and completions.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Program
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search programs..."
              value={search}
              onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
              className="w-full max-w-xs rounded-md border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value as TrainingStatus | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All Statuses</option>
            {Object.entries(TRAINING_STATUS_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {isLoading ? (
            <SkeletonTable rows={8} columns={7} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : programs.length === 0 ? (
            <EmptyState onAdd={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Title</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Category</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Provider</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Mandatory</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Duration</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((program) => {
                  const statusCfg = TRAINING_STATUS_CONFIG[program.status];
                  return (
                    <tr key={program.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-medium text-slate-900">{program.title}</div>
                        {program.description && (
                          <div className="text-xs text-slate-400 line-clamp-1">{program.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {program.category ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {program.provider ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {program.isMandatory ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {program.durationMinutes != null
                          ? `${program.durationMinutes} min`
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.bgColor, statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === program.id ? null : program.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            aria-label="Program actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuOpenId === program.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                              <button
                                onClick={() => { openEdit(program); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </button>
                              <button
                                onClick={() => { setConfirmDeleteId(program.id); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button>
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
        {!isLoading && !isError && programs.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + programs.length} of {total} programs
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

      {/* Training form modal */}
      <TrainingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        program={editingProgram}
      />

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Training Program?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete the training program. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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
      <h3 className="text-base font-semibold text-slate-900">Couldn't load training programs</h3>
      <p className="mt-1 text-sm text-slate-500">
        Something went wrong while fetching training programs.
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
        <GraduationCap className="h-7 w-7 text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">No training programs yet</h3>
      <p className="mt-1 text-sm text-slate-500">
        Create your first training program to start assigning and tracking completions.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> New Program
      </button>
    </div>
  );
}
