import { formatDistanceToNow, parseISO } from 'date-fns';
import { X, CheckCheck, Bell } from 'lucide-react';
import { useMarkRead, useDismissNotification } from '../hooks/use-notifications';
import type { Notification, NotificationPriority } from '../api/notifications.api';

const PRIORITY_CONFIG: Record<NotificationPriority, { dot: string; badge: string; label: string }> = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    label: 'Critical' },
  high:     { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'High' },
  medium:   { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',   label: 'Medium' },
  low:      { dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600', label: 'Low' },
};

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}

export function NotificationPanel({ notifications, unreadCount, onMarkAllRead }: NotificationPanelProps) {
  const markRead = useMarkRead();
  const dismiss  = useDismissNotification();

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Bell className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">You're all caught up</p>
        <p className="text-xs mt-1">No notifications to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {unreadCount > 0 && (
        <div className="flex items-center justify-end px-1 pb-2">
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all {unreadCount} as read
          </button>
        </div>
      )}
      {notifications.map((n) => {
        const pc = PRIORITY_CONFIG[n.priority] ?? PRIORITY_CONFIG.medium;
        const isUnread = !n.readAt;
        return (
          <div
            key={n.id}
            className={`flex gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
              isUnread ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mt-1.5 shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${pc.dot}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <p className={`text-sm leading-snug flex-1 ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                  {n.title}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pc.badge}`}>
                  {pc.label}
                </span>
              </div>
              {n.message && <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.message}</p>}
              <div className="mt-2 flex items-center gap-3">
                <p className="text-[11px] text-slate-400">
                  {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                </p>
                {isUnread && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark read
                  </button>
                )}
                {n.actionUrl && (
                  <a href={n.actionUrl} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">View</a>
                )}
              </div>
            </div>
            <button
              onClick={() => dismiss.mutate(n.id)}
              className="shrink-0 mt-0.5 rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
