// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'owner'
  | 'admin'
  | 'compliance_manager'
  | 'control_owner'
  | 'auditor'
  | 'viewer'
  | 'msp_admin'
  | 'msp_analyst';

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;           // user.id
  email: string;
  role: UserRole | null;
  tenantId: string | null;
  permissions: string[];
  requiresOnboarding: boolean;
  // Platform-owner flag, carried so the UI can decide whether to render
  // owner-only navigation. It is a HINT ONLY — every /api/billing/admin route
  // still calls requireSuperadmin, which re-reads the flag from the database on
  // each request. That matters because a token stays valid for its full 15
  // minutes, so a revoked superadmin would otherwise keep access until expiry.
  isSuperadmin: boolean;
  jti: string;           // unique token ID for revocation
  iat: number;
  exp: number;
}

// ─── Domain ───────────────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  onboardingCompletedAt: Date | null;
  // Lets the client show or hide owner-only navigation. Safe to expose: it
  // tells the user something they already know about their own account, and
  // grants nothing — every admin route independently re-checks the database.
  isSuperadmin: boolean;
  createdAt: Date;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  // Refresh token is delivered via httpOnly cookie, not this payload
}

export interface LoginResult {
  accessToken: string;
  user: UserPublic;
  activeTenant: TenantSummary | null;
  allTenants: TenantSummary[];
  requiresMfa: boolean;
  mfaChallengeToken?: string; // present only when requiresMfa === true
}

export interface MfaSetupResult {
  secret: string;        // raw TOTP secret (shown to user once for manual entry)
  qrCodeDataUri: string; // base64 data URI for QR code display
  backupCodes: string[]; // raw backup codes (shown to user once)
}

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}
