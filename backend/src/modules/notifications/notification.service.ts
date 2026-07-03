import { withTenantSchema } from '../../lib/prisma';
import { notificationRepository } from './notification.repository';
import type { CreateNotificationDto } from './notification.types';

export const notificationService = {
  async list(schemaName: string, userId: string, opts: { page?: number; limit?: number; unreadOnly?: boolean }) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.findForUser(tx, userId, opts),
    );
  },

  async countUnread(schemaName: string, userId: string) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.countUnread(tx, userId),
    );
  },

  async markRead(schemaName: string, id: string, userId: string) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.markRead(tx, id, userId),
    );
  },

  async markAllRead(schemaName: string, userId: string) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.markAllRead(tx, userId),
    );
  },

  async dismiss(schemaName: string, id: string, userId: string) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.dismiss(tx, id, userId),
    );
  },

  // Used internally by the reminder job to create notifications
  async createForUser(schemaName: string, dto: CreateNotificationDto) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.create(tx, dto),
    );
  },

  async createBulk(schemaName: string, dtos: CreateNotificationDto[]) {
    return withTenantSchema(schemaName, (tx) =>
      notificationRepository.createBulk(tx, dtos),
    );
  },
};
