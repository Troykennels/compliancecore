import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../config/database';

// Sets PostgreSQL session variables consumed by fn_write_audit_log() trigger.
// Must run after authenticate() so req.user is populated.
export function auditContext(): RequestHandler {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Session vars are set inside each transaction by the repository layer.
    // This middleware is a no-op placeholder — the actual SET LOCAL statements
    // are issued inside withTenantSchema() to respect PgBouncer transaction mode.
    next();
  };
}

// Called inside a Prisma transaction to stamp the audit log trigger context.
export async function setAuditSessionVars(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  user: { id: string; email: string; role: string | null },
): Promise<void> {
  await tx.$executeRaw`
    SELECT
      set_config('app.current_user_id',    ${user.id},    true),
      set_config('app.current_user_email', ${user.email}, true),
      set_config('app.current_user_role',  ${user.role ?? 'system'}, true)
  `;
}
