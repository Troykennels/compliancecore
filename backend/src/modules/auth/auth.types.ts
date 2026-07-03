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
