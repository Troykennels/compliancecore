import { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { dashboardService } from './dashboard.service';

export async function getDashboardSummary(req: Request, res: Response) {
  const data = await dashboardService.getSummary(req.tenant!.schemaName, req.user!.id);
  ok(res, req, data);
}
