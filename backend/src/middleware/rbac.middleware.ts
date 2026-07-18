import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError } from '../lib/errors';
import { prisma } from '../config/database';
import type { UserRole } from '../modules/auth/auth.types';

// Wildcard '*' grants all permissions (owner role)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: [
    'billing:read', 'billing:write',
    'controls:read', 'controls:write', 'controls:delete',
    'evidence:read', 'evidence:write', 'evidence:delete', 'evidence:share',
    'policies:read', 'policies:write', 'policies:delete',
    'risks:read', 'risks:write', 'risks:delete',
    'vendors:read', 'vendors:write', 'vendors:delete',
    'audits:read', 'audits:write', 'audits:delete',
    'training:read', 'training:write',
    'incidents:read', 'incidents:write',
    'privacy:read', 'privacy:write',
    'integrations:read', 'integrations:write',
    'reports:read', 'reports:write',
    'settings:read', 'settings:write',
    'team:read', 'team:write',
    'org:read', 'org:write',
    'frameworks:read',
    'calendar:read', 'calendar:write',
    'expiry:read', 'expiry:write',
    'notifications:read',
    'approvals:read', 'approvals:write', 'approvals:decide', 'approvals:manage',
    'signatures:read', 'signatures:create', 'signatures:manage',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'escalations:read', 'escalations:manage',
    'ai:use',
  ],
  compliance_manager: [
    'billing:read',
    'controls:read', 'controls:write',
    'evidence:read', 'evidence:write', 'evidence:share',
    'policies:read', 'policies:write',
    'risks:read', 'risks:write',
    'vendors:read', 'vendors:write',
    'audits:read', 'audits:write',
    'training:read', 'training:write',
    'incidents:read', 'incidents:write',
    'privacy:read', 'privacy:write',
    'integrations:read',
    'reports:read', 'reports:write',
    'settings:read',
    'team:read',
    'org:read',
    'frameworks:read',
    'calendar:read', 'calendar:write',
    'expiry:read', 'expiry:write',
    'notifications:read',
    'approvals:read', 'approvals:write', 'approvals:decide', 'approvals:manage',
    'signatures:read', 'signatures:create', 'signatures:manage',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'escalations:read', 'escalations:manage',
    'ai:use',
  ],
  control_owner: [
    'controls:read', 'controls:write',
    'evidence:read', 'evidence:write', 'evidence:share',
    'policies:read',
    'risks:read',
    'reports:read',
    'calendar:read', 'calendar:write',
    'expiry:read',
    'notifications:read',
    'approvals:read', 'approvals:write', 'approvals:decide',
    'signatures:read', 'signatures:create',
    'tasks:read', 'tasks:write',
    'escalations:read',
    'ai:use',
  ],
  auditor: [
    'controls:read',
    'evidence:read',
    'policies:read',
    'risks:read',
    'audits:read',
    'reports:read',
    'calendar:read',
    'expiry:read',
    'notifications:read',
    'approvals:read', 'approvals:decide',
    'signatures:read',
    'tasks:read',
    'escalations:read',
    'ai:use',
  ],
  viewer: [
    'controls:read',
    'evidence:read',
    'policies:read',
    'risks:read',
    'vendors:read',
    'reports:read',
    'calendar:read',
    'expiry:read',
    'notifications:read',
    'approvals:read',
    'signatures:read',
    'tasks:read',
    'escalations:read',
    'ai:use',
  ],
  msp_admin: [
    'msp:read', 'msp:write', 'msp:manage_clients',
    'controls:read', 'controls:write',
    'evidence:read', 'evidence:write', 'evidence:share',
    'calendar:read', 'calendar:write',
    'expiry:read', 'expiry:write',
    'notifications:read',
    'approvals:read', 'approvals:write', 'approvals:decide', 'approvals:manage',
    'signatures:read', 'signatures:create', 'signatures:manage',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'escalations:read', 'escalations:manage',
    'policies:read', 'policies:write',
    'risks:read', 'risks:write',
    'reports:read', 'reports:write',
    'settings:read', 'settings:write',
    'team:read', 'team:write',
    'org:read', 'org:write',
    'frameworks:read',
  ],
  msp_analyst: [
    'msp:read',
    'controls:read',
    'evidence:read',
    'policies:read',
    'risks:read',
    'reports:read',
    'org:read',
    'frameworks:read',
    'approvals:read',
    'signatures:read',
    'tasks:read',
    'escalations:read',
    'notifications:read',
    'ai:use',
  ],
};

export function getPermissionsForRole(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.includes('*') || userPermissions.includes(required);
}

export function requirePermission(permission: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError());
    }
    if (!hasPermission(req.user.permissions, permission)) {
      return next(new ForbiddenError(`Missing permission: ${permission}`));
    }
    next();
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

// Checks is_superadmin flag in the database — used for platform-level admin routes
export const requireSuperadmin: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) return next(new ForbiddenError());
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isSuperadmin: true },
    });
    if (!user?.isSuperadmin) return next(new ForbiddenError('Superadmin access required'));
    next();
  } catch (err) {
    next(err);
  }
};
