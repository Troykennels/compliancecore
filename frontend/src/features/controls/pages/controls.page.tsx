import { useState, useEffect, useRef } from 'react';
import { parseISO, isPast } from 'date-fns';
import {
  Plus, Search, ShieldCheck, MoreHorizontal, Pencil, Trash2, CheckCircle2,
  ChevronLeft, ChevronRight, AlertCircle, SearchX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useControls, useDeleteControl, useMarkReviewed } from '../hooks/use-controls';
import { ControlFormModal } from '../components/control-form-modal';
import type {
  Control,
  ControlCriticality,
  ControlImplementationStatus,
} from '../types/controls.types';
import { CRITICALITY_CONFIG, IMPLEMENTATION_STATUS_CONFIG } from '../types/controls.types';
import { useOrgFormat } from '@/lib/org-format';
import {
  Button, Card, EmptyState, ErrorState, PageHeader, PageShell, SkeletonTable,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function ControlsPage(): JSX.Element {
  const fmt = useOrgFormat();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ControlImplementationStatus | ''>('');
  const [criticalityFilter, setCriticalityFilter] = useState<ControlCriticality | ''>('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingControl, setEditingControl] = useState<Control | undefined>();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useControls({
    q: search || undefined,
    status: statusFilter || undefined,
    criticality: criticalityFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { mutate: deleteControl, isPending: isDeleting } = useDeleteControl();
  const { mutate: markReviewed } = useMarkReviewed();

  const controls = data?.controls ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // An empty list because nothing matches the filters is a different situation
  // from an empty list because nothing exists, and needs different words.
  const isFiltered = Boolean(search || statusFilter || criticalityFilter);

  // The row menu previously stayed open until its trigger was clicked again,
  // so scrolling away left a menu floating over the table.
  useEffect(() => {
    if (!menuOpenId) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpenId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpenId(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpenId]);

  // Escape closes the delete confirmation, as a dialog should.
  useEffect(() => {
    if (!confirmDeleteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmDeleteId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDeleteId]);

  function openCreate() {
    setEditingControl(undefined);
    setModalOpen(true);
  }

  function openEdit(control: Control) {
    setEditingControl(control);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    deleteControl(id, { onSuccess: () => setConfirmDeleteId(null) });
  }

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setCriticalityFilter('');
    setPage(1);
  }

  const selectClass =
    'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-xs transition-colors hover:border-slate-400';

  return (
    <PageShell>
      <PageHeader
        title="Controls"
        description="Define and track the compliance controls that power your compliance score."
        actions={
          <Button onClick={openCreate}>
            <Plus /> New control
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search controls…"
            aria-label="Search controls"
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value as ControlImplementationStatus | '')}
          aria-label="Filter by implementation status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(IMPLEMENTATION_STATUS_CONFIG).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>

        <select
          value={criticalityFilter}
          onChange={(e) => resetToFirstPage(setCriticalityFilter)(e.target.value as ControlCriticality | '')}
          aria-label="Filter by criticality"
          className={selectClass}
        >
          <option value="">All criticalities</option>
          {Object.entries(CRITICALITY_CONFIG).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card flush className="overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={8} columns={8} />
        ) : isError ? (
          <ErrorState
            title="We couldn't load your controls"
            onRetry={() => refetch()}
          />
        ) : controls.length === 0 ? (
          isFiltered ? (
            <EmptyState
              icon={<SearchX />}
              title="No controls match those filters"
              description="Try a different search term, or widen the status and criticality filters."
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<ShieldCheck />}
              title="No controls yet"
              description="Controls are the individual safeguards you implement and evidence. Adopt a framework to bring in its full control set, or add one of your own."
              action={<Button onClick={openCreate}><Plus /> New control</Button>}
            />
          )
        ) : (
          // Horizontal scroll lives on the table's own container, so a wide
          // table never pushes the whole page sideways on a laptop or tablet.
          <div className="scroll-x">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Ref</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Title</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Framework</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Criticality</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Status</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Owner</th>
                  <th scope="col" className="px-6 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">Due date</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {controls.map((control) => {
                  const critCfg = CRITICALITY_CONFIG[control.criticality];
                  const statusCfg = IMPLEMENTATION_STATUS_CONFIG[control.implementationStatus];
                  const isOverdue =
                    control.dueDate &&
                    isPast(parseISO(control.dueDate)) &&
                    control.implementationStatus !== 'implemented' &&
                    control.implementationStatus !== 'not_applicable';
                  return (
                    <tr key={control.id} className="group transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-slate-900">
                        {control.controlRef}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-slate-900">{control.title}</div>
                        {control.category && (
                          <div className="mt-0.5 text-xs text-slate-500">{control.category}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {control.frameworkName ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ring-current/20', critCfg.bgColor, critCfg.color)}>
                          {critCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ring-current/20', statusCfg.bgColor, statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {control.ownerName ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className={cn('whitespace-nowrap px-6 py-3.5', isOverdue ? 'font-semibold text-red-700' : 'text-slate-600')}>
                        {control.dueDate ? (
                          <span className="inline-flex items-center gap-1.5">
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                            {fmt.formatDateMedium(control.dueDate)}
                            {isOverdue && <span className="sr-only">(overdue)</span>}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="relative inline-block" ref={menuOpenId === control.id ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={() => setMenuOpenId(menuOpenId === control.id ? null : control.id)}
                            // Visible on hover and whenever focused, so the
                            // control is reachable by keyboard rather than
                            // being hover-only.
                            className={cn(
                              'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700',
                              'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
                              menuOpenId === control.id && 'opacity-100',
                            )}
                            aria-label={`Actions for ${control.controlRef}`}
                            aria-haspopup="menu"
                            aria-expanded={menuOpenId === control.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuOpenId === control.id && (
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-20 mt-1 w-44 animate-scale-in rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg"
                            >
                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => { openEdit(control); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4 text-slate-400" /> Edit
                              </button>
                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => { markReviewed(control.id); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <CheckCircle2 className="h-4 w-4 text-slate-400" /> Mark reviewed
                              </button>
                              <div className="my-1 h-px bg-slate-100" role="none" />
                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => { setConfirmDeleteId(control.id); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
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
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && !isError && controls.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p data-numeric className="text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + controls.length}</span> of{' '}
            <span className="font-medium text-slate-700">{total}</span> controls
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft /> Previous
            </Button>
            <span data-numeric className="px-1 text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      {/* Control form modal */}
      <ControlFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        control={editingControl}
      />

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => setConfirmDeleteId(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-control-title"
            aria-describedby="delete-control-body"
            className="relative z-10 w-full max-w-sm animate-scale-in rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <h2 id="delete-control-title" className="text-base font-semibold text-slate-900">
              Delete this control?
            </h2>
            <p id="delete-control-body" className="mt-1.5 text-sm leading-relaxed text-slate-500">
              The control and its implementation history are removed permanently,
              and your compliance score will be recalculated without it. This
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={isDeleting}
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {isDeleting ? 'Deleting…' : 'Delete control'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
