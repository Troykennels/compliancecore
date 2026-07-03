import { useState } from 'react';
import { Plus, Search, Users, MoreHorizontal, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDepartments, useDeleteDepartment } from '../hooks/use-departments';
import { DepartmentFormModal } from '../components/department-form-modal';
import type { DepartmentWithRelations } from '../types/departments.types';

export function DepartmentsPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentWithRelations | undefined>();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useDepartments({ search: search || undefined });
  const { mutate: deleteDepartment, isPending: isDeleting } = useDeleteDepartment();

  function openCreate() {
    setEditingDept(undefined);
    setModalOpen(true);
  }

  function openEdit(dept: DepartmentWithRelations) {
    setEditingDept(dept);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    deleteDepartment(id, { onSuccess: () => setConfirmDeleteId(null) });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
            <p className="mt-1 text-sm text-slate-500">
              Structure your organisation into departments and teams.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Department
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : !data?.departments?.length ? (
            <EmptyState onAdd={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Department</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Branch</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Parent</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Head</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {dept.parentDepartmentId && (
                          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                        )}
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50">
                          <Users className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{dept.name}</div>
                          {dept.code && <div className="text-xs text-slate-400">{dept.code}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {dept.branchName ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {dept.parentDepartmentName ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {dept.headUserName ? (
                        <div>
                          <div>{dept.headUserName}</div>
                          {dept.headUserEmail && (
                            <div className="text-xs text-slate-400">{dept.headUserEmail}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          dept.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === dept.id ? null : dept.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpenId === dept.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                            <button
                              onClick={() => { openEdit(dept); setMenuOpenId(null); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            <button
                              onClick={() => { setConfirmDeleteId(dept.id); setMenuOpenId(null); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && (
          <p className="mt-3 text-xs text-slate-400">
            Showing {data.departments?.length ?? 0} of {data.total} departments
          </p>
        )}
      </div>

      <DepartmentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        department={editingDept}
      />

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Department?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete the department. Sub-departments will be moved to top-level.
              This action cannot be undone.
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

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
        <Users className="h-7 w-7 text-violet-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">No departments yet</h3>
      <p className="mt-1 text-sm text-slate-500">
        Add your first department to organise your team.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> Add Department
      </button>
    </div>
  );
}
