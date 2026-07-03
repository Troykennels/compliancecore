import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string | null;
  notificationType: string;
  priority: NotificationPriority;
  referenceType: string | null;
  referenceId: string | null;
  actionUrl: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export const notificationsApi = {
  list(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    return apiClient.get<ApiResponse<NotificationsListResponse>>('/notifications', { params });
  },
  getUnreadCount() {
    return apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
  },
  markRead(id: string) {
    return apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`, {});
  },
  markAllRead() {
    return apiClient.post<ApiResponse<{ updated: number }>>('/notifications/mark-all-read', {});
  },
  dismiss(id: string) {
    return apiClient.delete(`/notifications/${id}`);
  },
};
