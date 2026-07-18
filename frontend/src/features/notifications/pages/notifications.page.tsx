import { useState } from 'react';
import { useNotifications, useMarkAllRead } from '../hooks/use-notifications';
import { NotificationPanel } from '../components/notification-panel';

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage]             = useState(1);
  const LIMIT = 25;

  const { data, isLoading, isError, refetch } = useNotifications({ unreadOnly, page, limit: LIMIT });
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const total         = data?.total ?? 0;
  const unreadCount   = data?.unreadCount ?? 0;
  const totalPages    = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-5">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Unread only
          </label>
        </div>
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
