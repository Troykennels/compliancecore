import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

// Must be the last middleware registered in app.ts (4-argument signature required by Express)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // A ZodError anywhere in a handler is a client input problem → 422, not 500.
  // Some modules (ai, reports) call schema.parse() directly instead of the
  // shared validate() helper; catch their errors here so they aren't reported
  // as server faults.
  if (err instanceof ZodError) {
    res.status(422).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      meta: { requestId: req.requestId },
    });
    return;
  }

  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      data: null,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
      meta: { requestId: req.requestId },
    });
    return;
  }

  // Unknown / unexpected error — never leak internals in production
  logger.error({ err, requestId: req.requestId, path: req.path }, 'Unhandled error');
  res.status(500).json({
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : (err instanceof Error ? err.message : String(err)),
    },
    meta: { requestId: req.requestId },
  });
}
