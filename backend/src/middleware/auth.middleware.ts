import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { redis, REDIS_KEYS } from '../config/redis';
import { isTokenRevoked } from '../lib/token-revocation';
import { AppError, UnauthorizedError, ForbiddenError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { ROLE_PERMISSIONS } from './rbac.middleware';
import type { UserRole } from '../modules/auth/auth.types';

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

    try {
      if (await redis.exists(REDIS_KEYS.revokedToken(payload.jti))) {
        return next(new UnauthorizedError('Token has been revoked'));
      }
      if (await isTokenRevoked(payload.sub, payload.iat)) {
        return next(new UnauthorizedError('Session is no longer valid. Please sign in again.'));
      }
    } catch {
      return next(new AppError('Session checks are temporarily unavailable. Please try again.',503,'SESSION_CHECK_UNAVAILABLE'));
    }

    // Fresh authority is checked here so it covers every authenticated route,
    // including onboarding/profile routes that do not run resolveTenant.
    try {
      if (payload.isSuperadmin) {
        const user=await prisma.user.findFirst({where:{id:payload.sub,isActive:true,deletedAt:null,isSuperadmin:true},select:{id:true}});
        if(!user)return next(new ForbiddenError('Your platform access changed. Sign in again.'));
      } else if (payload.tenantId) {
        const membership=await prisma.tenantMembership.findFirst({
          where:{tenantId:payload.tenantId,userId:payload.sub,isActive:true,deletedAt:null,user:{isActive:true,deletedAt:null}},select:{role:true},
        });
        if(!membership||membership.role!==payload.role)return next(new ForbiddenError('Your organisation access changed. Sign in again.'));
      } else {
        const user=await prisma.user.findFirst({where:{id:payload.sub,isActive:true,deletedAt:null},select:{id:true}});
        if(!user)return next(new UnauthorizedError('This account is no longer active.'));
      }
    } catch(error) { return next(error); }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      permissions: payload.isSuperadmin ? payload.permissions : (ROLE_PERMISSIONS[payload.role as UserRole] ?? []),
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
