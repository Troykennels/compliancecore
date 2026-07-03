import { apiClient } from '@/lib/api-client';
import type { OrganizationProfile, UpdateOrganizationDto } from '../types/organization.types';
import type { ApiResponse } from '@/types/api';

export const organizationApi = {
  create(data: { name: string; industry?: string; size?: string }) {
    return apiClient.post<ApiResponse<{ organization: { id: string; name: string; slug: string } }>>(
      '/organizations',
      data,
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

  completeOnboarding() {
    return apiClient.post<ApiResponse<{ id: string; onboardingDoneAt: string }>>(
      '/organizations/onboarding/complete',
    );
  },
};
