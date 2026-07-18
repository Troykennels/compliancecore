import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { auditsService } from './audits.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listAudits(req: Request, res: Response) {
  const data = await auditsService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getAudit(req: Request, res: Response) {
  const data = await auditsService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createAudit(req: Request, res: Response) {
  const data = await auditsService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateAudit(req: Request, res: Response) {
  const data = await auditsService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteAudit(req: Request, res: Response) {
  await auditsService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function listFindings(req: Request, res: Response) {
  const data = await auditsService.listFindings(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createFinding(req: Request, res: Response) {
  const data = await auditsService.createFinding(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  created(res, req, data);
}

export async function updateFinding(req: Request, res: Response) {
  const data = await auditsService.updateFinding(req.tenant!.schemaName, req.params.findingId, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteFinding(req: Request, res: Response) {
  await auditsService.deleteFinding(req.tenant!.schemaName, req.params.findingId, actor(req));
  noContent(res);
}
