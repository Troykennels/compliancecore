import type { AuthUser, TenantSummary } from '@/stores/auth.store';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MfaChallengeRequest {
  mfaChallengeToken: string;
  code: string;
}

export interface MfaBackupCodeRequest {
  mfaChallengeToken: string;
  backupCode: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  activeTenant: TenantSummary | null;
  allTenants: TenantSummary[];
  requiresMfa: boolean;
  mfaChallengeToken?: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeDataUri: string;
  backupCodes: string[];
}
