import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus, Search, Building2, MoreHorizontal, Pencil, Trash2,
  AlertTriangle, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendors, useDeleteVendor } from '../hooks/use-vendors';
import { VendorFormModal } from '../components/vendor-form-modal';
import type {
  Vendor,
  VendorRiskLevel,
  VendorStatus,
} from '../types/vendors.types';
import { RISK_LEVEL_CONFIG, VENDOR_STATUS_CONFIG } from '../types/vendors.types';

const PAGE_SIZE = 20;

export function VendorsPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | ''>('');
  const [riskFilter, setRiskFilter] = useState<VendorRiskLevel | ''>('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useVendors({
    q: search || undefined,
    status: statusFilter || undefined,
    riskLevel: riskFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { mutate: deleteVendor, isPending: isDeleting } = useDeleteVendor();

  const vendors = data?.vendors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditingVendor(undefined);
    setModalOpen(true);
  }

  function openEdit(vendor: Vendor) {
    setEditingVendor(vendor);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    deleteVendor(id, { onSuccess: () => setConfirmDeleteId(null) });
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
            <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your third-party vendors and track their risk and review status.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Vendor
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
              className="w-full max-w-xs rounded-md border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value as VendorStatus | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All Statuses</option>
            {Object.entries(VENDOR_STATUS_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>

          <select
            value={riskFilter}
            onChange={(e) => resetToFirstPage(setRiskFilter)(e.target.value as VendorRiskLevel | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All Risk Levels</option>
            {Object.entries(RISK_LEVEL_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : vendors.length === 0 ? (
            <EmptyState onAdd={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Category</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Risk level</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Contact</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Next review</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((vendor) => {
                  const riskCfg = RISK_LEVEL_CONFIG[vendor.riskLevel];
                  const statusCfg = VENDOR_STATUS_CONFIG[vendor.status];
                  return (
                    <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{vendor.name}</div>
                        {vendor.website && (
                          <div className="text-xs text-slate-400">{vendor.website}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {vendor.category ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', riskCfg.bgColor, riskCfg.color)}>
                          {riskCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.bgColor, statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {vendor.contactName || vendor.contactEmail ? (
                          <div>
                            {vendor.contactName && <div className="text-slate-700">{vendor.contactName}</div>}
                            {vendor.contactEmail && <div className="text-xs text-slate-400">{vendor.contactEmail}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {vendor.nextReviewDate ? (
                          format(parseISO(vendor.nextReviewDate), 'MMM d, yyyy')
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === vendor.id ? null : vendor.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            aria-label="Vendor actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuOpenId === vendor.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                              <button
                                onClick={() => { openEdit(vendor); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </button>
                              <button
                                onClick={() => { setConfirmDeleteId(vendor.id); setMenuOpenId(null); }}
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
        {!isLoading && !isError && vendors.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + vendors.length} of {total} vendors
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

      {/* Vendor form modal */}
      <VendorFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vendor={editingVendor}
      />

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Vendor?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete the vendor. This action cannot be undone.
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
      <h3 className="text-base font-semibold text-slate-900">Couldn't load vendors</h3>
      <p className="mt-1 text-sm text-slate-500">
        Something went wrong while fetching vendors.
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
        <Building2 className="h-7 w-7 text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">No vendors yet</h3>
      <p className="mt-1 text-sm text-slate-500">
        Add your first vendor to start tracking third-party risk.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> New Vendor
      </button>
    </div>
  );
}
