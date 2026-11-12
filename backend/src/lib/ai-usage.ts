import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../config/database';
import { AppError } from './errors';
import { logger } from './logger';

// ─── AI usage allowance (prompt sections 10 and 12) ─────────────────────────
//
// Each AI request counts against the plan's monthly allowance
// (subscription_plans.max_ai_requests_monthly; null = no plan limit). The
// counter is one row per organisation per calendar month (UTC), claimed with a
// single conditional upsert, so two requests racing at the limit cannot both
// get through. The platform owner is not counted.

export async function initAiUsageTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.ai_usage (
    tenant_id UUID NOT NULL,
    month DATE NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, month))`);
}

export function monthStart(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Claims one request; false when the allowance for this month is used up. */
export async function claimAiRequest(tenantId: string, limit: number, now = new Date()): Promise<boolean> {
  if (limit <= 0) return false;
  const rows = await prisma.$queryRawUnsafe<Array<{ requests: number }>>(
    `INSERT INTO global.ai_usage (tenant_id, month, requests) VALUES ($1::uuid, $2::date, 1)
     ON CONFLICT (tenant_id, month) DO UPDATE SET requests = global.ai_usage.requests + 1, updated_at = NOW()
       WHERE global.ai_usage.requests < $3
     RETURNING requests`,
    tenantId, monthStart(now), limit,
  );
  return rows.length > 0;
}

/** Gives back one claimed request (the AI call failed). */
export async function releaseAiRequest(tenantId: string, now = new Date()): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE global.ai_usage SET requests = GREATEST(requests - 1, 0), updated_at = NOW() WHERE tenant_id = $1::uuid AND month = $2::date`,
    tenantId, monthStart(now));
}

export async function aiUsageThisMonth(tenantId: string, now = new Date()): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ requests: number }>>(
    `SELECT requests FROM global.ai_usage WHERE tenant_id = $1::uuid AND month = $2::date`, tenantId, monthStart(now));
  return Number(rows[0]?.requests ?? 0);
}

/** After enforceEntitlement on the AI router. */
export function enforceAiAllowance(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ent = req.entitlement;
      const tenantId = req.tenant?.id ?? req.user?.tenantId;
      if (!ent || !tenantId || req.user?.isSuperadmin) return next();
      const limit = ent.aiRequestsMonthly;
      if (limit === null) return next();
      if (await claimAiRequest(tenantId, limit)) {
        // A request that ends in an error (provider down, rejected input) gives
        // its slot back: the allowance counts answers, not attempts.
        res.on('finish', () => { if (res.statusCode >= 400) void releaseAiRequest(tenantId).catch(() => undefined); });
        return next();
      }
      return next(new AppError(
        `Your ${ent.planName ?? 'current'} plan includes ${limit} AI requests a month and they have been used. They renew on the 1st, or upgrade your plan for more.`,
        402, 'AI_LIMIT_REACHED', { limit },
      ));
    } catch (err) {
      // An allowance lookup problem never blocks work (fail open), like the other plan checks.
      logger.error({ err }, 'AI allowance check failed — allowing request');
      return next();
    }
  };
}
