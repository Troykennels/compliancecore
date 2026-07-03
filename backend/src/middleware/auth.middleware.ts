import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { redis, REDIS_KEYS } from '../config/redis';
import { UnauthorizedError } from '../lib/errors';

export function authenticate(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Bearer token required'));
    }

    const token = authHeader.slice(7);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(new UnauthorizedError('Invalid or expired token'));
    }

    // Check token revocation list (populated on logout)
    const isRevoked = await redis.exists(REDIS_KEYS.revokedToken(payload.jti));
    if (isRevoked) {
      return next(new UnauthorizedError('Token has been revoked'));
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      permissions: payload.permissions,
      jti: payload.jti,
      requiresOnboarding: payload.requiresOnboarding ?? false,
    };

    next();
  };
}
