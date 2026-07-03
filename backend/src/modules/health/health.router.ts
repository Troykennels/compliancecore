import { Router } from 'express';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

/**
 * Kubernetes/Railway-style probes.
 *   GET /health        -> shallow (already defined in app.ts, kept for compat)
 *   GET /health/live   -> liveness: process is running, never touches deps
 *   GET /health/ready  -> readiness: verifies Postgres + Redis, 503 if degraded
 */
export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok', check: 'live', timestamp: new Date().toISOString() });
});

healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = { database: 'down', redis: 'down' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'up';
  } catch {
    /* leave as down */
  }

  try {
    const pong = await redis.ping();
    if (pong === 'PONG') checks.redis = 'up';
  } catch {
    /* leave as down */
  }

  const ok = checks.database === 'up' && checks.redis === 'up';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
