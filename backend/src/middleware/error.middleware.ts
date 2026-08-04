import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * Postgres SQLSTATEs that mean "the client sent something invalid", mapped to
 * the status the client should actually receive.
 *
 * Deliberately narrow: only codes whose cause is unambiguously the request.
 * Anything else keeps falling through to a 500, because a 4xx on a genuine
 * server fault hides the fault.
 */
const PG_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  '22P02': { status: 400, code: 'INVALID_INPUT', message: 'A value in the request is not in a valid format.' },
  '22007': { status: 400, code: 'INVALID_DATE', message: 'A date in the request could not be understood.' },
  '22008': { status: 400, code: 'INVALID_DATE', message: 'A date in the request is out of range.' },
  '22003': { status: 400, code: 'NUMBER_OUT_OF_RANGE', message: 'A number in the request is out of range.' },
  '22001': { status: 400, code: 'VALUE_TOO_LONG', message: 'A value in the request is too long.' },
  '23502': { status: 400, code: 'MISSING_FIELD', message: 'A required field is missing.' },
  '23503': { status: 400, code: 'RELATED_RECORD_MISSING', message: 'A referenced record does not exist.' },
  '23505': { status: 409, code: 'ALREADY_EXISTS', message: 'A record with those details already exists.' },
  '23514': { status: 400, code: 'CONSTRAINT_VIOLATION', message: 'A value in the request is not allowed.' },
  '2201W': { status: 400, code: 'INVALID_INPUT', message: 'A row count in the request must not be negative.' },
  '2201X': { status: 400, code: 'INVALID_INPUT', message: 'An offset in the request must not be negative.' },
};

/**
 * Digs the SQLSTATE out of whatever shape the driver threw.
 *
 * Prisma wraps a raw-query failure as PrismaClientKnownRequestError with its
 * OWN code — `P2010` — and puts the real SQLSTATE on `meta.code`. Both are five
 * uppercase alphanumerics, so a "looks like a SQLSTATE" test matches Prisma's
 * wrapper first and never reaches the code that matters. Rather than trying to
 * tell the two apart by shape, every candidate is collected and the first one
 * we actually recognise wins — a wrapper code simply doesn't match and is
 * skipped.
 */
function asPostgresError(err: unknown, depth = 0): { code: string } | null {
  if (!err || typeof err !== 'object' || depth > 4) return null;
  const e = err as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };

  const candidates = [e.meta?.code, e.code].filter(
    (c): c is string => typeof c === 'string' && c in PG_ERROR_MAP,
  );
  if (candidates.length > 0) return { code: candidates[0] };

  return e.cause ? asPostgresError(e.cause, depth + 1) : null;
}

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

  // Postgres rejected the request because of what the client sent, not because
  // anything is broken here. Without this every one of these surfaced as a 500:
  // `GET /api/controls/not-a-uuid` was an "internal error", and so was creating
  // a second evidence category with a name that already exists.
  //
  // Translating centrally rather than guarding each of the ~40 `:id` routes
  // means a route added tomorrow is covered too, and there is no route left
  // behind because someone forgot the middleware.
  const pg = asPostgresError(err);
  if (pg) {
    const mapped = PG_ERROR_MAP[pg.code];
    if (mapped) {
      res.status(mapped.status).json({
        data: null,
        error: { code: mapped.code, message: mapped.message },
        meta: { requestId: req.requestId },
      });
      return;
    }
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
