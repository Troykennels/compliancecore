import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  MfaChallengeRequest,
  MfaBackupCodeRequest,
  MfaSetupResponse,
} from '../types/auth.types';
import type { AuthUser, TenantSummary } from '@/stores/auth.store';

export const authApi = {
  register: async (data: RegisterRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/register', data),

  login: async (data: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data),

  completeMfaChallenge: async (data: MfaChallengeRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/mfa/challenge', data),

  completeMfaWithBackupCode: async (data: MfaBackupCodeRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/mfa/challenge/backup', data),

  logout: async () => apiClient.post<ApiResponse<{ message: string }>>('/auth/logout'),

  logoutAll: async () => apiClient.post<ApiResponse<{ message: string }>>('/auth/logout-all'),

  refresh: async () =>
    apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),

  me: async () =>
    apiClient.get<ApiResponse<AuthUser & { tenants: TenantSummary[] }>>('/auth/me'),

  verifyEmail: async (token: string) =>
    apiClient.get<ApiResponse<{ message: string }>>(`/auth/verify-email?token=${token}`),

  forgotPassword: async (data: ForgotPasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/forgot-password', data),

  resetPassword: async (data: ResetPasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', data),

  changePassword: async (data: ChangePasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', data),

  setupMfa: async () =>
    apiClient.post<ApiResponse<MfaSetupResponse>>('/auth/mfa/setup'),

  confirmMfaSetup: async (code: string) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/mfa/setup/confirm', { code }),

  disableMfa: async (password: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>('/auth/mfa', { data: { password } }),

  switchTenant: async (tenantId: string) =>
    apiClient.post<ApiResponse<{ accessToken: string; activeTenant: TenantSummary }>>(
      '/auth/switch-tenant',
      { tenantId },
    ),

  getSessions: async () =>
    apiClient.get<ApiResponse<SessionInfo[]>>('/auth/sessions'),

  revokeSession: async (sessionId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/auth/sessions/${sessionId}`),
};

interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}
