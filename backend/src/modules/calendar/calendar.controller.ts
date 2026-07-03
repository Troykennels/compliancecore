import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { calendarService } from './calendar.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listEvents(req: Request, res: Response) {
  const data = await calendarService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getEvent(req: Request, res: Response) {
  const data = await calendarService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createEvent(req: Request, res: Response) {
  const data = await calendarService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateEvent(req: Request, res: Response) {
  const data = await calendarService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteEvent(req: Request, res: Response) {
  await calendarService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function getUpcoming(req: Request, res: Response) {
  const daysAhead = req.query.days ? Number(req.query.days) : 14;
  const data = await calendarService.getUpcoming(req.tenant!.schemaName, daysAhead);
  ok(res, req, data);
}
