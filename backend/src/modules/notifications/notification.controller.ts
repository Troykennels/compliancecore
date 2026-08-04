import { Request, Response } from 'express';
import { z } from 'zod';
import { ok, noContent } from '../../lib/response';
import { notificationService } from './notification.service';

// Notifications was the one list endpoint with no query schema: `page` and
// `limit` went through a bare Number() and were then interpolated into
// `LIMIT ... OFFSET ...`. `?limit=abc` produced `LIMIT NaN` (a syntax error,
// surfaced as a 500), `?page=0` produced a negative OFFSET, and `?limit=1000000`
// read a million rows. Every sibling list caps and coerces the same way.
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function listNotifications(req: Request, res: Response) {
  const { page, limit, unreadOnly } = listQuerySchema.parse(req.query);
  const data = await notificationService.list(req.tenant!.schemaName, req.user!.id, {
    page,
    limit,
    unreadOnly,
  });
  ok(res, req, data);
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await notificationService.countUnread(req.tenant!.schemaName, req.user!.id);
  ok(res, req, { count });
}

export async function markRead(req: Request, res: Response) {
  await notificationService.markRead(req.tenant!.schemaName, req.params.id, req.user!.id);
  noContent(res);
}

export async function markAllRead(req: Request, res: Response) {
  await notificationService.markAllRead(req.tenant!.schemaName, req.user!.id);
  noContent(res);
}

export async function dismissNotification(req: Request, res: Response) {
  await notificationService.dismiss(req.tenant!.schemaName, req.params.id, req.user!.id);
  noContent(res);
}
