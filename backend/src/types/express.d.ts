import type { UserRole } from '../modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user: {
        id: string;
        email: string;
        role: UserRole | null;
        tenantId: string | null;
        permissions: string[];
        jti: string;
        exp: number;
        requiresOnboarding: boolean;
        // UI hint only — requireSuperadmin re-reads this from the database on
        // every admin request, so a stale token cannot retain owner access.
        isSuperadmin: boolean;
      };
      // entitlement is set by enforceEntitlement() (entitlement.middleware.ts).
      // Present on any tenant-scoped route so limit checks and the client
      // banner can reuse the lookup instead of repeating it.
      entitlement?: import('../lib/entitlements').Entitlement;
      // tenant is set by resolveTenant() middleware (tenant.middleware.ts)
      tenant?: {
        id: string;
        schemaName: string;
        name: string;
        plan: string;
      };
    }
  }
}

export {};
