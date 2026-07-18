import { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/response';
import { scoreService } from './score.service';

// `days` is user-supplied. A non-numeric value used to become NaN and reach the
// SQL as "'NaN days'", 500-ing the request. Coerce, default when absent/invalid,
// then clamp to a sane [7, 365] window before it touches the interval literal.
const trendQuerySchema = z.object({
  days: z
    .preprocess((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 180;
    }, z.number())
    .transform((n) => Math.min(365, Math.max(7, Math.trunc(n)))),
});

export async function getCurrentScore(req: Request, res: Response) {
  const data = await scoreService.calculateCurrentScore(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function getScoreTrend(req: Request, res: Response) {
  const { days } = trendQuerySchema.parse(req.query);
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
