import { apiClient, refreshSession, beginAuthChange } from '@/lib/api-client';
import { stopDeviceAlerts } from '@/lib/device-alerts';
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

  login: async (data: LoginRequest) => {
    beginAuthChange();
    return apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
  },

  completeMfaChallenge: async (data: MfaChallengeRequest) => {
    beginAuthChange();
    return apiClient.post<ApiResponse<LoginResponse>>('/auth/mfa/challenge', data);
  },

  completeMfaWithBackupCode: async (data: MfaBackupCodeRequest) => {
    beginAuthChange();
    return apiClient.post<ApiResponse<LoginResponse>>('/auth/mfa/challenge/backup', data);
  },

  logout: async () => {
    beginAuthChange();
    await stopDeviceAlerts(endpoint => apiClient.delete('/notifications/push',{data:{endpoint},timeout:3000})).catch(()=>{});
    return apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
  },

  logoutAll: async () => {
    beginAuthChange();
    return apiClient.post<ApiResponse<{ message: string }>>('/auth/logout-all');
  },

  refresh: refreshSession,

  me: async () =>
    apiClient.get<ApiResponse<AuthUser & { tenants: TenantSummary[] }>>('/auth/me'),

  verifyEmail: async (token: string) =>
    apiClient.get<ApiResponse<{ message: string }>>(`/auth/verify-email?token=${token}`),

  resendVerification: async (email: string) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/resend-verification', { email }),

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

  switchTenant: async (tenantId: string) => {
    beginAuthChange();
    return apiClient.post<ApiResponse<{ accessToken: string; activeTenant: TenantSummary }>>(
      '/auth/switch-tenant',
      { tenantId },
    );
  },

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
