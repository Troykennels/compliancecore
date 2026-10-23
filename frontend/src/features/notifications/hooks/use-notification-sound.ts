import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import type { Notification } from '../api/notifications.api';
import { claimSound, playNotificationSound, soundEnabled } from '../lib/notification-sound';

export function useNotificationSound(notifications: Notification[] | undefined) {
  const { user, activeTenant } = useAuthStore();
  const account = user && activeTenant ? `${user.id}:${activeTenant.id}` : '';
  const seen = useRef<{ account: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!account || !notifications) return;
    const ids = notifications.map(n => n.id);
    if (seen.current?.account !== account) { seen.current = { account, ids: new Set(ids) }; return; }
    const fresh = notifications.filter(n => !n.readAt && !seen.current!.ids.has(n.id)).map(n => n.id);
    ids.forEach(id => seen.current!.ids.add(id));
    if (seen.current.ids.size > 300) seen.current.ids = new Set(ids);
    // Background alerts are handled by Web Push and the OS, avoiding duplicate
    // sounds and relying on neither a suspended tab nor an autoplay bypass.
    if (document.visibilityState === 'visible' && fresh.length && soundEnabled(account) && claimSound(account, fresh)) {
      void playNotificationSound().catch(() => {});
    }
  }, [account, notifications]);
}
