import { apiClient } from '@/lib/api-client';
import type { OrganizationProfile, UpdateOrganizationDto } from '../types/organization.types';
import type {
  ScopingProfile, ScopingResponse, FrameworkRecommendation,
} from '../types/scoping.types';
import type { ApiResponse } from '@/types/api';

export const organizationApi = {
  create(data: { name: string; industry?: string; size?: string }) {
    return apiClient.post<ApiResponse<{ organization: { id: string; name: string; slug: string } }>>(
      '/organizations',
      data,
      // Overrides the 30s client default. This request provisions a whole tenant
      // schema — every per-tenant table and index — against a managed database,
      // which regularly runs past 30s. Aborting client-side does NOT cancel the
      // server, so the tenant still gets created and the user is left looking at
      // a failure for work that succeeded, then told the organisation already
      // exists when they retry.
      { timeout: 180_000 },
    );
  },

  getProfile() {
    return apiClient.get<ApiResponse<{ organization: OrganizationProfile }>>(
      '/organizations/profile',
    );
  },

  updateProfile(dto: UpdateOrganizationDto) {
    return apiClient.patch<ApiResponse<{ organization: OrganizationProfile }>>(
      '/organizations/profile',
      dto,
    );
  },

  getScoping() {
    return apiClient.get<ApiResponse<ScopingResponse>>('/organizations/scoping');
  },

  saveScoping(profile: ScopingProfile) {
    return apiClient.post<ApiResponse<{ profile: ScopingProfile; recommendations: FrameworkRecommendation[] }>>(
      '/organizations/scoping',
      profile,
    );
  },

  completeOnboarding() {
    return apiClient.post<ApiResponse<{ id: string; onboardingDoneAt: string }>>(
      '/organizations/onboarding/complete',
    );
  },
};
