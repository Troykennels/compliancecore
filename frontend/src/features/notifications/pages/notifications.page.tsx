import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useNotifications, useMarkAllRead } from '../hooks/use-notifications';
import { NotificationPanel } from '../components/notification-panel';

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage]             = useState(1);
  const [priority, setPriority] = useState('');
  const [notificationType, setNotificationType] = useState('');
  const LIMIT = 25;

  const { data, isLoading, isError, refetch } = useNotifications({ unreadOnly, page, limit: LIMIT, priority: priority || undefined, notificationType: notificationType || undefined });
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const total         = data?.total ?? 0;
  const unreadCount   = data?.unreadCount ?? 0;
  const totalPages    = Math.ceil(total / LIMIT);

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <div className="mb-6"><PageHeader eyebrow="Account" title="Notifications" description={<>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</>} actions={<><div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Unread only
          </label></div></>} /></div>

      <div className="workspace-toolbar">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Priority<select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }} className="rounded-md border bg-white px-3 py-2 text-sm"><option value="">All priorities</option>{['critical','high','medium','low'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Event type<select value={notificationType} onChange={e => { setNotificationType(e.target.value); setPage(1); }} className="rounded-md border bg-white px-3 py-2 text-sm"><option value="">All event types</option>{['expiry_warning','calendar_reminder','task_assigned','task_comment','approval_requested','approval_decided','approval_deadline_warning','escalation','system'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/^./, c => c.toUpperCase())}</option>)}</select></label>
        <a href="/settings/notifications" className="ml-auto text-sm font-semibold text-brand-700 underline">Manage my preferences</a>
      </div>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
          <p className="text-sm">Couldn't load notifications.</p>
          <button
            onClick={() => refetch()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={() => markAll.mutate()}
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 shrink-0 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
