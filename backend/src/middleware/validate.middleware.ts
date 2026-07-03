import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Target = 'body' | 'query' | 'params';

export function validateQuery(schema: ZodSchema): RequestHandler {
  return validate(schema, 'query');
}

export function validate(schema: ZodSchema, target: Target = 'body'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(422).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
        meta: { requestId: req.requestId },
      });
      return;
    }
    req[target] = result.data;
    next();
  };
}

function formatZodError(err: ZodError) {
  return err.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.');
    acc[key] = issue.message;
    return acc;
  }, {});
}
