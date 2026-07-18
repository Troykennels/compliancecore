import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead, useDismissNotification } from '../hooks/use-notifications';
import type { Notification } from '../api/notifications.api';
import { useNavigate } from 'react-router-dom';

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-blue-500',
  low:      'bg-slate-400',
};

function NotificationRow({ n, onRead, onDismiss }: {
  n: Notification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();

  function handleClick() {
    if (!n.readAt) onRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  }

  return (
    <div
      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-blue-50/50' : ''}`}
      onClick={handleClick}
    >
      <div className="mt-1.5 shrink-0">
        <div className={`h-2 w-2 rounded-full ${PRIORITY_DOT[n.priority] ?? 'bg-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!n.readAt ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
        {n.message && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>}
        <p className="mt-1 text-[10px] text-slate-400">{formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
        className="shrink-0 mt-1 rounded p-0.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const navigate        = useNavigate();
  const { data: count } = useUnreadCount();
  const { data }        = useNotifications({ limit: 15 });
  const markRead        = useMarkRead();
  const markAll         = useMarkAllRead();
  const dismiss         = useDismissNotification();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = data?.notifications ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {!!count && count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Dropdown header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {!!count && count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Bell className="h-7 w-7 mb-2 opacity-40" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onRead={(id) => markRead.mutate(id)}
                  onDismiss={(id) => dismiss.mutate(id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="flex w-full items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              View all <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
