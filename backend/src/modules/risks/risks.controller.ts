import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { risksService } from './risks.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listRisks(req: Request, res: Response) {
  const data = await risksService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getRisk(req: Request, res: Response) {
  const data = await risksService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createRisk(req: Request, res: Response) {
  const data = await risksService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateRisk(req: Request, res: Response) {
  const data = await risksService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteRisk(req: Request, res: Response) {
  await risksService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function getRiskStats(req: Request, res: Response) {
  const data = await risksService.getStats(req.tenant!.schemaName);
  ok(res, req, data);
}
