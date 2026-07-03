import { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { scoreService } from './score.service';

export async function getCurrentScore(req: Request, res: Response) {
  const data = await scoreService.calculateCurrentScore(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function getScoreTrend(req: Request, res: Response) {
  const days = req.query.days ? Number(req.query.days) : 180;
  const data = await scoreService.getScoreTrend(req.tenant!.schemaName, days);
  ok(res, req, data);
}

export async function getLatestSnapshot(req: Request, res: Response) {
  const data = await scoreService.getLatestSnapshot(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function triggerSnapshot(req: Request, res: Response) {
  await scoreService.takeSnapshot(req.tenant!.schemaName);
  ok(res, req, { message: 'Snapshot saved.' });
}
