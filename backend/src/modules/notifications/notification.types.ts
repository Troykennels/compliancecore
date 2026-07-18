export type NotificationType =
  | 'expiry_warning' | 'calendar_reminder' | 'score_drop'
  | 'evidence_shared' | 'control_overdue' | 'system' | 'reminder'
  | 'task_assigned' | 'task_comment'
  | 'approval_requested' | 'approval_decided' | 'approval_deadline_warning'
  | 'escalation';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  // Alias of `body` — the frontend renders `n.message`. Kept in sync in the
  // repository mapper so notification content actually shows.
  message: string | null;
  notificationType: NotificationType;
  priority: NotificationPriority;
  referenceType: string | null;
  referenceId: string | null;
  actionUrl: string | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface CreateNotificationDto {
  userId: string;
  title: string;
  body?: string | null;
  notificationType: NotificationType;
  priority?: NotificationPriority;
  referenceType?: string | null;
  referenceId?: string | null;
  actionUrl?: string | null;
}
