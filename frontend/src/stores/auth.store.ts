import { create } from 'zustand';
import { setAccessToken, clearAccessToken } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

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
  switchTenant: (tenantId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  switchTenant: (tenantId) => {
    const tenant = get().allTenants.find((t) => t.id === tenantId) ?? null;
    // Tenant-scoped data must not carry over — clear the cache so every query
    // refetches under the new tenant instead of showing stale wrong-tenant data.
    queryClient.clear();
    set({ activeTenant: tenant });
  },
}));

// Derived selectors
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useActiveTenant = () => useAuthStore((s) => s.activeTenant);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useUserRole = () => useAuthStore((s) => s.activeTenant?.role ?? null);
export const useRequiresOnboarding = () =>
  useAuthStore((s) => s.isAuthenticated && !s.user?.onboardingCompletedAt);
