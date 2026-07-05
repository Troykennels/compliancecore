import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/error.middleware';
import { AppError } from '../../src/lib/errors';

function mockReqRes() {
  const req = { requestId: 'req-1', path: '/x' } as unknown as Request;
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return { req, res: res as unknown as Response & { statusCode: number; body: any } };
}

const noopNext = (() => undefined) as unknown as import('express').NextFunction;

describe('errorHandler', () => {
  it('maps a ZodError to HTTP 422 (not 500)', () => {
    const { req, res } = mockReqRes();
    const zodErr = z.object({ name: z.string() }).safeParse({ name: 123 });
    expect(zodErr.success).toBe(false);

    errorHandler((zodErr as { error: unknown }).error, req, res, noopNext);

    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('honours an AppError status code and code', () => {
    const { req, res } = mockReqRes();
    errorHandler(new AppError('nope', 403, 'FORBIDDEN'), req, res, noopNext);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('falls back to 500 for an unexpected error', () => {
    const { req, res } = mockReqRes();
    errorHandler(new Error('boom'), req, res, noopNext);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
