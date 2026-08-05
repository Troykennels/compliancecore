import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { redis, REDIS_KEYS } from '../config/redis';
import { isTokenRevoked } from '../lib/token-revocation';
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

    // Per-user cut-off. The jti list above only ever covers the token its owner
    // handed back at logout; this is what actually ends a session someone else
    // is holding — a removed member, a demoted admin, or an attacker after the
    // victim changes their password.
    if (await isTokenRevoked(payload.sub, payload.iat)) {
      return next(new UnauthorizedError('Session is no longer valid. Please sign in again.'));
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      permissions: payload.permissions,
      jti: payload.jti,
      exp: payload.exp,
      requiresOnboarding: payload.requiresOnboarding ?? false,
      // Defaults to false so tokens issued before this claim existed are simply
      // treated as non-superadmin rather than undefined.
      isSuperadmin: payload.isSuperadmin ?? false,
    };

    next();
  };
}
