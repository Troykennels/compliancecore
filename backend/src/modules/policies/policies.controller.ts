import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { policiesService } from './policies.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listPolicies(req: Request, res: Response) {
  const data = await policiesService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getPolicy(req: Request, res: Response) {
  const data = await policiesService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createPolicy(req: Request, res: Response) {
  const data = await policiesService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updatePolicy(req: Request, res: Response) {
  const data = await policiesService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deletePolicy(req: Request, res: Response) {
  await policiesService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function publishPolicy(req: Request, res: Response) {
  const data = await policiesService.publish(req.tenant!.schemaName, req.params.id, actor(req));
  ok(res, req, data);
}
