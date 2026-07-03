import { Prisma } from '@prisma/client';
import type { Notification, NotificationListResult, CreateNotificationDto } from './notification.types';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): Notification {
  return {
    id:               row.id as string,
    userId:           row.userId as string,
    title:            row.title as string,
    body:             row.body as string | null,
    notificationType: row.notificationType as Notification['notificationType'],
    priority:         row.priority as Notification['priority'],
    referenceType:    row.referenceType as string | null,
    referenceId:      row.referenceId as string | null,
    actionUrl:        row.actionUrl as string | null,
    readAt:           row.readAt ? new Date(row.readAt as string) : null,
    dismissedAt:      row.dismissedAt ? new Date(row.dismissedAt as string) : null,
    createdAt:        new Date(row.createdAt as string),
  };
}

export const notificationRepository = {
  async create(tx: Tx, dto: CreateNotificationDto): Promise<string> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO notifications (user_id, title, body, notification_type, priority, reference_type, reference_id, action_url)
      VALUES (
        ${dto.userId}::uuid, ${dto.title}, ${dto.body ?? null},
        ${dto.notificationType}, ${dto.priority ?? 'medium'},
        ${dto.referenceType ?? null}, ${dto.referenceId ?? null}::uuid,
        ${dto.actionUrl ?? null}
      )
      RETURNING id
    `;
    return rows[0].id;
  },

  async createBulk(tx: Tx, dtos: CreateNotificationDto[]): Promise<void> {
    for (const dto of dtos) {
      await notificationRepository.create(tx, dto);
    }
  },

  async findForUser(
    tx: Tx,
    userId: string,
    opts: { page?: number; limit?: number; unreadOnly?: boolean },
  ): Promise<NotificationListResult> {
    const { page = 1, limit = 30, unreadOnly = false } = opts;
    const offset = (page - 1) * limit;
    const unreadFilter = unreadOnly ? 'AND n.read_at IS NULL' : '';

    const [rows, countRows, unreadRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          n.id, n.user_id AS "userId", n.title, n.body,
          n.notification_type AS "notificationType", n.priority,
          n.reference_type AS "referenceType", n.reference_id AS "referenceId",
          n.action_url AS "actionUrl",
          n.read_at AS "readAt", n.dismissed_at AS "dismissedAt", n.created_at AS "createdAt"
        FROM notifications n
        WHERE n.user_id = $1::uuid AND n.dismissed_at IS NULL ${unreadFilter}
        ORDER BY n.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, userId),
      tx.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) FROM notifications n WHERE n.user_id = $1::uuid AND n.dismissed_at IS NULL ${unreadFilter}`,
        userId,
      ),
      tx.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1::uuid AND read_at IS NULL AND dismissed_at IS NULL`,
        userId,
      ),
    ]);

    return {
      notifications: rows.map(mapRow),
      total:         Number(countRows[0].count),
      unreadCount:   Number(unreadRows[0].count),
    };
  },

  async countUnread(tx: Tx, userId: string): Promise<number> {
    const rows = await tx.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM notifications
      WHERE user_id = ${userId}::uuid AND read_at IS NULL AND dismissed_at IS NULL
    `;
    return Number(rows[0].count);
  },

  async markRead(tx: Tx, id: string, userId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE notifications SET read_at = NOW()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND read_at IS NULL
    `;
  },

  async markAllRead(tx: Tx, userId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE notifications SET read_at = NOW()
      WHERE user_id = ${userId}::uuid AND read_at IS NULL
    `;
  },

  async dismiss(tx: Tx, id: string, userId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE notifications SET dismissed_at = NOW()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    `;
  },
};
