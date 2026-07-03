import { Request, Response } from 'express';

export function ok<T>(res: Response, req: Request, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    requestId: (req as Request & { id?: string }).id,
    data,
  });
}

export function created<T>(res: Response, req: Request, data: T): void {
  ok(res, req, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).end();
}
