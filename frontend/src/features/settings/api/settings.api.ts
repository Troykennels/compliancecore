import { apiClient } from '@/lib/api-client';
import type {
  TeamMember,
  ApiKey,
  ApiKeyCreated,
  Webhook,
  WebhookCreated,
  NotificationSettings,
} from '../types/settings.types';
import type { ApiResponse } from '@/types/api';

export const settingsApi = {
  // ── Team ────────────────────────────────────────────────────────────────────
  listMembers() {
    return apiClient.get<ApiResponse<{ members: TeamMember[] }>>('/settings/team/members');
  },

  inviteMember(data: { email: string; role: string }) {
    return apiClient.post<ApiResponse<{ message: string }>>('/settings/team/members/invite', data);
  },

  updateMemberRole(membershipId: string, role: string) {
    return apiClient.patch<ApiResponse<{ message: string }>>(
      `/settings/team/members/${membershipId}/role`,
      { role },
    );
  },

  removeMember(membershipId: string) {
    return apiClient.delete(`/settings/team/members/${membershipId}`);
  },

  // ── API Keys ─────────────────────────────────────────────────────────────────
  listApiKeys() {
    return apiClient.get<ApiResponse<{ apiKeys: ApiKey[] }>>('/settings/api-keys');
  },

  createApiKey(data: { name: string; permissions: string[]; expiresAt?: string | null }) {
    return apiClient.post<ApiResponse<{ apiKey: ApiKeyCreated }>>('/settings/api-keys', data);
  },

  revokeApiKey(id: string) {
    return apiClient.delete(`/settings/api-keys/${id}`);
  },

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  listWebhooks() {
    return apiClient.get<ApiResponse<{ webhooks: Webhook[] }>>('/settings/webhooks');
  },

  createWebhook(data: { name: string; url: string; events: string[] }) {
    return apiClient.post<ApiResponse<{ webhook: WebhookCreated }>>('/settings/webhooks', data);
  },

  updateWebhook(id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
    return apiClient.patch<ApiResponse<{ message: string }>>(`/settings/webhooks/${id}`, data);
  },

  deleteWebhook(id: string) {
    return apiClient.delete(`/settings/webhooks/${id}`);
  },

  rotateWebhookSecret(id: string) {
    return apiClient.post<ApiResponse<{ secret: string }>>(`/settings/webhooks/${id}/rotate-secret`);
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  getNotificationSettings() {
    return apiClient.get<ApiResponse<{ notificationSettings: NotificationSettings }>>(
      '/settings/notifications',
    );
  },

  updateNotificationSettings(data: Partial<NotificationSettings>) {
    return apiClient.patch<ApiResponse<{ notificationSettings: NotificationSettings }>>(
      '/settings/notifications',
      data,
    );
  },
};
