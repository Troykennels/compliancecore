import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { incidentsService } from './incidents.service';

function actor(req: Request) {
  return {
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role ?? null,
    tenantId: req.user!.tenantId ?? null,
  };
}

export async function listIncidents(req: Request, res: Response) {
  const data = await incidentsService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getIncidentStats(req: Request, res: Response) {
  const data = await incidentsService.stats(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function getIncident(req: Request, res: Response) {
  const data = await incidentsService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createIncident(req: Request, res: Response) {
  const data = await incidentsService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateIncident(req: Request, res: Response) {
  const data = await incidentsService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteIncident(req: Request, res: Response) {
  await incidentsService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function listIncidentUpdates(req: Request, res: Response) {
  const data = await incidentsService.listUpdates(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function addIncidentUpdate(req: Request, res: Response) {
  const data = await incidentsService.addUpdate(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  created(res, req, data);
}
