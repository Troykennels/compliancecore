import React, { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Plus, AlertTriangle, ShieldCheck, Clock, XCircle, Search } from 'lucide-react';
import { useExpiryItems, useExpiryStats, useDeleteExpiryItem } from '../hooks/use-expiry';
import { ExpiryFormModal } from '../components/expiry-form-modal';
import type { ExpiryItem, ExpiryStatus, ExpiryEntityType } from '../types/expiry.types';
import { ENTITY_TYPE_LABELS, STATUS_CONFIG } from '../types/expiry.types';

interface StatCardProps { label: string; value: number; icon: React.ReactNode; colorClass: string; }

function StatCard({ label, value, icon, colorClass }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function daysUntilLabel(dateStr: string): { text: string; color: string } {
  const diff = differenceInDays(parseISO(dateStr), new Date());
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-600' };
  if (diff === 0) return { text: 'Due today',                 color: 'text-red-600' };
  if (diff <= 7)  return { text: `${diff}d left`,             color: 'text-red-600' };
  if (diff <= 30) return { text: `${diff}d left`,             color: 'text-amber-600' };
  if (diff <= 90) return { text: `${diff}d left`,             color: 'text-yellow-600' };
  return { text: `${diff}d left`, color: 'text-slate-500' };
}

export function ExpiryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected]   = useState<ExpiryItem | null>(null);
  const [query, setQuery]         = useState('');
  const [filterStatus, setFilterStatus]     = useState<ExpiryStatus | ''>('');
  const [filterEntityType, setFilterEntityType] = useState<ExpiryEntityType | ''>('');

  const { data: statsData } = useExpiryStats();
  const { data, isLoading } = useExpiryItems({
    status:     filterStatus || undefined,
    entityType: filterEntityType || undefined,
    q:          query || undefined,
  });
  const deleteItem = useDeleteExpiryItem();

  const items: ExpiryItem[] = data?.items ?? [];
  const stats = statsData ?? { active: 0, expiringSoon: 0, expired: 0, renewed: 0, cancelled: 0 };

  function openCreate() { setSelected(null); setModalOpen(true); }
  function openEdit(item: ExpiryItem) { setSelected(item); setModalOpen(true); }
  async function handleDelete(id: string) {
    if (confirm('Remove this expiry item?')) await deleteItem.mutateAsync(id);
  }

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Expiry Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">Certificates, policies, contracts and renewals</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Track Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 shrink-0">
        <StatCard label="Active"        value={stats.active}        colorClass="bg-green-100 text-green-600"  icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Expiring Soon" value={stats.expiringSoon}  colorClass="bg-amber-100 text-amber-600"  icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Expired"       value={stats.expired}       colorClass="bg-red-100 text-red-600"      icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Renewed"       value={stats.renewed}       colorClass="bg-blue-100 text-blue-600"    icon={<XCircle className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ExpiryStatus | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as ExpiryStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={filterEntityType}
          onChange={(e) => setFilterEntityType(e.target.value as ExpiryEntityType | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Types</option>
          {(Object.entries(ENTITY_TYPE_LABELS) as [ExpiryEntityType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
          No expiry items found. Click "Track Item" to get started.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-500 px-4 py-2.5">Name</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2.5">Type</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2.5">Expiry Date</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2.5">Remaining</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2.5">Status</th>
                <th className="text-right font-medium text-slate-500 px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const remaining = daysUntilLabel(item.expiryDate);
                const cfg = STATUS_CONFIG[item.status];
                return (
                  <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.notes && <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ENTITY_TYPE_LABELS[item.entityType]}</td>
                    <td className="px-4 py-3 text-slate-600">{format(parseISO(item.expiryDate), 'MMM d, yyyy')}</td>
                    <td className={`px-4 py-3 font-medium ${remaining.color}`}>{remaining.text}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="text-xs text-slate-600 hover:text-slate-900 mr-3">Edit</button>
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExpiryFormModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} item={selected} />
    </div>
  );
}
