import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { vendorsService } from './vendors.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listVendors(req: Request, res: Response) {
  const data = await vendorsService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getVendor(req: Request, res: Response) {
  const data = await vendorsService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createVendor(req: Request, res: Response) {
  const data = await vendorsService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateVendor(req: Request, res: Response) {
  const data = await vendorsService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteVendor(req: Request, res: Response) {
  await vendorsService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function listVendorAssessments(req: Request, res: Response) {
  const data = await vendorsService.listAssessments(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createVendorAssessment(req: Request, res: Response) {
  const data = await vendorsService.createAssessment(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  created(res, req, data);
}
