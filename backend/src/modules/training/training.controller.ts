import { Request, Response } from 'express';
import { ok, created, noContent } from '../../lib/response';
import { trainingService } from './training.service';

function actor(req: Request) {
  return { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null, tenantId: req.user!.tenantId ?? null };
}

export async function listTrainings(req: Request, res: Response) {
  const data = await trainingService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getTraining(req: Request, res: Response) {
  const data = await trainingService.getById(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function createTraining(req: Request, res: Response) {
  const data = await trainingService.create(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateTraining(req: Request, res: Response) {
  const data = await trainingService.update(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  ok(res, req, data);
}

export async function deleteTraining(req: Request, res: Response) {
  await trainingService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

export async function listTrainingRecords(req: Request, res: Response) {
  const data = await trainingService.listRecords(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function assignTrainingRecords(req: Request, res: Response) {
  const data = await trainingService.assignRecords(req.tenant!.schemaName, req.params.id, req.body, actor(req));
  created(res, req, data);
}
