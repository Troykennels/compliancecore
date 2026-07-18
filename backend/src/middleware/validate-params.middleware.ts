import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Matches a canonical RFC 4122 UUID (any version). Route params that feed
// directly into `::uuid`-typed SQL columns must match this, otherwise Postgres
// raises an "invalid input syntax for type uuid" error that surfaces as a 500.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards a route :param so a malformed UUID returns a clean 400 instead of a
 * 500 from the database. Defaults to the `id` param.
 */
export function validateUuidParam(name = 'id'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[name];
    if (!value || !UUID_RE.test(value)) {
      res.status(400).json({
        data: null,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid ${name}: must be a valid UUID`,
        },
        meta: { requestId: req.requestId },
      });
      return;
    }
    next();
  };
}
