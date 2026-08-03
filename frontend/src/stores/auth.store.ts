import { create } from 'zustand';
import { setAccessToken, clearAccessToken } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { authApi } from '@/features/auth/api/auth.api';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'compliance_manager'
  | 'control_owner'
  | 'auditor'
  | 'viewer'
  | 'msp_admin'
  | 'msp_analyst';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
  onboardingCompletedAt: string | null;
  // Platform-owner flag. Used only to decide whether owner-only navigation is
  // rendered — the API enforces access independently on every admin route, so
  // a tampered client gains nothing by flipping this.
  isSuperadmin?: boolean;
  // Whether a *verified* TOTP credential exists. Drives the security page only;
  // the server decides independently whether to issue an MFA challenge.
  mfaEnabled?: boolean;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  activeTenant: TenantSummary | null;
  allTenants: TenantSummary[];
  isAuthenticated: boolean;
  isInitialising: boolean;

  setAuth: (
    user: AuthUser,
    accessToken: string,
    activeTenant: TenantSummary | null,
    allTenants: TenantSummary[],
  ) => void;
  clearAuth: () => void;
  setInitialised: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeTenant: null,
  allTenants: [],
  isAuthenticated: false,
  isInitialising: true,

  setAuth: (user, accessToken, activeTenant, allTenants) => {
    setAccessToken(accessToken);
    set({ user, activeTenant, allTenants, isAuthenticated: true, isInitialising: false });
  },

  clearAuth: () => {
    clearAccessToken();
    // Drop every cached query so the next user on this device can't see the
    // previous session's data (dashboard, evidence, billing, …).
    queryClient.clear();
    set({ user: null, activeTenant: null, allTenants: [], isAuthenticated: false, isInitialising: false });
  },

  setInitialised: () => {
    set({ isInitialising: false });
  },

  // Switching organisation MUST go through the API. The backend reads the active
  // tenant from the signed access token, so changing only local state would leave
  // every request still hitting the previous organisation while the UI claimed
  // otherwise — the same data labelled with the wrong company name.
  switchTenant: async (tenantId) => {
    const { data } = await authApi.switchTenant(tenantId);
    const { accessToken, activeTenant } = data.data;
    setAccessToken(accessToken);
    // Tenant-scoped data must not carry over — clear the cache so every query
    // refetches under the new tenant instead of showing stale wrong-tenant data.
    queryClient.clear();
    set({ activeTenant });
  },
}));

// Derived selectors
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useActiveTenant = () => useAuthStore((s) => s.activeTenant);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useUserRole = () => useAuthStore((s) => s.activeTenant?.role ?? null);
export const useRequiresOnboarding = () =>
  useAuthStore((s) => s.isAuthenticated && !s.user?.onboardingCompletedAt);
