import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '../api/notifications.api';

export const notifKeys = {
  all: ['notifications'] as const,
  list: (p: object) => [...notifKeys.all, 'list', p] as const,
  unreadCount: () => [...notifKeys.all, 'unread-count'] as const,
};

export function useNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: notifKeys.list(params),
    queryFn: () => notificationsApi.list(params).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.data?.count ?? 0),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
      toast.success('All notifications marked as read.');
    },
    onError: () => toast.error('Failed to mark notifications as read.'),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
    onError: () => toast.error('Failed to dismiss notification.'),
  });
}
