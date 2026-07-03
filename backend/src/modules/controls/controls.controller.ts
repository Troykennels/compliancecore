import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { controlsService } from './controls.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listControls(req: Request, res: Response) {
  const data = await controlsService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getControl(req: Request, res: Response) {
  const data = await controlsService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createControl(req: Request, res: Response) {
  const data = await controlsService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateControl(req: Request, res: Response) {
  const data = await controlsService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteControl(req: Request, res: Response) {
  await controlsService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function markReviewed(req: Request, res: Response) {
  const data = await controlsService.markReviewed(req.tenant!.schemaName, req.params.id, actor(req));
  ok(res, req, data);
}

export async function getControlStatusCounts(req: Request, res: Response) {
  const data = await controlsService.getStatusCounts(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function getOverdueControls(req: Request, res: Response) {
  const data = await controlsService.getOverdue(req.tenant!.schemaName);
  ok(res, req, data);
}
