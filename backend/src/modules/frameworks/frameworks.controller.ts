import { Request, Response } from 'express';
import { ok, created } from '../../lib/response';
import { frameworksService } from './frameworks.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listFrameworks(req: Request, res: Response) {
  const data = await frameworksService.list(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function getFramework(req: Request, res: Response) {
  const data = await frameworksService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function adoptFramework(req: Request, res: Response) {
  const data = await frameworksService.adopt(req.tenant!.schemaName, req.params.id, actor(req));
  created(res, req, data);
}

/**
 * True when this framework's controls are already in the tenant.
 *
 * Used by the plan-limit guard so a re-adoption — which is idempotent and adds
 * nothing — is not refused just because the tenant is at its framework limit.
 */
export async function isFrameworkAlreadyAdopted(req: Request): Promise<boolean> {
  const schemaName = req.tenant?.schemaName;
  if (!schemaName || !req.params.id) return false;
  return frameworksService.isAdopted(schemaName, req.params.id);
}
