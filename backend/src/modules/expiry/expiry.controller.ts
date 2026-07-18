import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { expiryService } from './expiry.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listExpiry(req: Request, res: Response) {
  const data = await expiryService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getExpiryItem(req: Request, res: Response) {
  const data = await expiryService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createExpiryItem(req: Request, res: Response) {
  const data = await expiryService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateExpiryItem(req: Request, res: Response) {
  const data = await expiryService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteExpiryItem(req: Request, res: Response) {
  await expiryService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function getExpiryStatusCounts(req: Request, res: Response) {
  const data = await expiryService.getStatusCounts(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function expiringSoon(req: Request, res: Response) {
  const raw = Number(req.query.days);
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 365) : 30;
  const data = await expiryService.expiringSoon(req.tenant!.schemaName, days);
  ok(res, req, data);
}
