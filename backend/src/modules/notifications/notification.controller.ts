import { Request, Response } from 'express';
import { ok, noContent } from '../../lib/response';
import { notificationService } from './notification.service';

export async function listNotifications(req: Request, res: Response) {
  const { page, limit, unreadOnly } = req.query;
  const data = await notificationService.list(req.tenant!.schemaName, req.user!.id, {
    page:       page ? Number(page) : 1,
    limit:      limit ? Number(limit) : 30,
    unreadOnly: unreadOnly === 'true',
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
