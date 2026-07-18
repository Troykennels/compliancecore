import { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { analyticsService } from './analytics.service';

export async function getAnalyticsOverview(req: Request, res: Response) {
  const data = await analyticsService.getOverview(req.tenant!.schemaName);
  ok(res, req, data);
}
